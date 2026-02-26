#!/usr/bin/env python3
"""
UX Contrast Guard — WCAG AA Contrast Ratio Validator for DD Legal PMO Design Tokens

Validates contrast ratios for design token color pairs and lints .tsx files for
hardcoded hex colors. Uses WCAG 2.1 relative luminance formula.

Exit codes:
  0 = All checks passed
  1 = One or more checks failed
"""

import re
import sys
import os
from pathlib import Path
from typing import Dict, Tuple, List, Optional
import math


class ColorConverter:
    """Convert colors between hex, hsl, hsla, rgba and RGB."""

    @staticmethod
    def hex_to_rgb(hex_color: str) -> Optional[Tuple[int, int, int]]:
        """Convert #RRGGBB or #RGB to (R, G, B)."""
        hex_color = hex_color.strip().lstrip('#')

        if len(hex_color) == 6:
            return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        elif len(hex_color) == 3:
            return tuple(int(c * 2, 16) for c in hex_color)
        return None

    @staticmethod
    def hsl_to_rgb(h: float, s: float, l: float) -> Tuple[int, int, int]:
        """Convert HSL to RGB. h: 0-360, s: 0-100, l: 0-100."""
        h = h % 360
        s = s / 100
        l = l / 100

        def hue_to_rgb(p: float, q: float, t: float) -> float:
            if t < 0:
                t += 1
            if t > 1:
                t -= 1
            if t < 1/6:
                return p + (q - p) * 6 * t
            if t < 1/2:
                return q
            if t < 2/3:
                return p + (q - p) * (2/3 - t) * 6
            return p

        if s == 0:
            r = g = b = l
        else:
            q = l * (1 + s) if l < 0.5 else l + s - l * s
            p = 2 * l - q
            r = hue_to_rgb(p, q, h / 360 + 1/3)
            g = hue_to_rgb(p, q, h / 360)
            b = hue_to_rgb(p, q, h / 360 - 1/3)

        return (
            max(0, min(255, round(r * 255))),
            max(0, min(255, round(g * 255))),
            max(0, min(255, round(b * 255)))
        )

    @staticmethod
    def rgba_to_rgb(r: int, g: int, b: int, a: float, bg_rgb: Tuple[int, int, int] = (255, 255, 255)) -> Tuple[int, int, int]:
        """Composite RGBA over background RGB."""
        alpha = a
        bg_r, bg_g, bg_b = bg_rgb
        return (
            max(0, min(255, round(r * alpha + bg_r * (1 - alpha)))),
            max(0, min(255, round(g * alpha + bg_g * (1 - alpha)))),
            max(0, min(255, round(b * alpha + bg_b * (1 - alpha))))
        )

    @staticmethod
    def parse_color(color_str: str, bg_rgb: Optional[Tuple[int, int, int]] = None) -> Optional[Tuple[int, int, int]]:
        """Parse various color formats to RGB."""
        color_str = color_str.strip()

        # Hex format
        if color_str.startswith('#'):
            return ColorConverter.hex_to_rgb(color_str)

        # HSL format: hsl(h, s%, l%)
        hsl_match = re.match(r'hsl\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*%\s*,\s*(\d+(?:\.\d+)?)\s*%\s*\)', color_str)
        if hsl_match:
            h, s, l = float(hsl_match.group(1)), float(hsl_match.group(2)), float(hsl_match.group(3))
            return ColorConverter.hsl_to_rgb(h, s, l)

        # HSLA format: hsla(h, s%, l%, a)
        hsla_match = re.match(r'hsla\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*%\s*,\s*(\d+(?:\.\d+)?)\s*%\s*,\s*(\d+(?:\.\d+)?)\s*\)', color_str)
        if hsla_match:
            h, s, l, a = float(hsla_match.group(1)), float(hsla_match.group(2)), float(hsla_match.group(3)), float(hsla_match.group(4))
            rgb = ColorConverter.hsl_to_rgb(h, s, l)
            if bg_rgb:
                return ColorConverter.rgba_to_rgb(rgb[0], rgb[1], rgb[2], a, bg_rgb)
            return rgb

        # RGBA format: rgba(r, g, b, a)
        rgba_match = re.match(r'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)\s*\)', color_str)
        if rgba_match:
            r, g, b, a = int(rgba_match.group(1)), int(rgba_match.group(2)), int(rgba_match.group(3)), float(rgba_match.group(4))
            if bg_rgb:
                return ColorConverter.rgba_to_rgb(r, g, b, a, bg_rgb)
            return (r, g, b)

        return None


class WCAGValidator:
    """WCAG 2.1 contrast ratio validator."""

    @staticmethod
    def relative_luminance(rgb: Tuple[int, int, int]) -> float:
        """Calculate relative luminance per WCAG 2.1 definition."""
        def adjust_channel(c: int) -> float:
            c = c / 255.0
            return c / 12.92 if c <= 0.03928 else math.pow((c + 0.055) / 1.055, 2.4)

        r, g, b = adjust_channel(rgb[0]), adjust_channel(rgb[1]), adjust_channel(rgb[2])
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    @staticmethod
    def contrast_ratio(fg_rgb: Tuple[int, int, int], bg_rgb: Tuple[int, int, int]) -> float:
        """Calculate contrast ratio between two colors."""
        l1 = WCAGValidator.relative_luminance(fg_rgb)
        l2 = WCAGValidator.relative_luminance(bg_rgb)
        lighter = max(l1, l2)
        darker = min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)


class TokenParser:
    """Parse CSS custom properties from tokens.css."""

    @staticmethod
    def parse_tokens_css(filepath: str) -> Dict[str, str]:
        """Extract CSS custom properties (--var-name: value)."""
        tokens = {}
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            print(f"Error: {filepath} not found")
            return tokens

        # Match --var-name: value patterns
        pattern = r'--([a-z0-9\-]+)\s*:\s*([^;]+);'
        matches = re.findall(pattern, content, re.IGNORECASE)

        for name, value in matches:
            tokens[f'--{name}'] = value.strip()

        return tokens

    @staticmethod
    def resolve_var_reference(var_name: str, tokens: Dict[str, str]) -> Optional[str]:
        """Resolve var() references in token values."""
        if var_name not in tokens:
            return None

        value = tokens[var_name]
        var_match = re.match(r'var\(--([a-z0-9\-]+)\)', value)
        if var_match:
            referenced = f'--{var_match.group(1)}'
            if referenced != var_name:
                return TokenParser.resolve_var_reference(referenced, tokens)
        return value


class ContrastValidator:
    """Main validator orchestrating contrast checks."""

    def __init__(self, tokens_path: str, src_path: str):
        self.tokens_path = tokens_path
        self.src_path = src_path
        self.tokens = TokenParser.parse_tokens_css(tokens_path)
        self.results = []
        self.failed_count = 0

        # Define contrast pairs: (fg_token, bg_token, min_ratio)
        self.contrast_pairs = [
            ('--g-text-primary', '--g-surface-card', 4.5),
            ('--g-text-primary', '--g-surface-page', 4.5),
            ('--g-text-secondary', '--g-surface-card', 4.5),
            ('--g-text-muted', '--g-surface-card', 3.0),
            ('--g-text-inverse', '--g-brand-3308', 4.5),
            ('--g-brand-bright', '--g-brand-3308', 3.0),
            ('--g-text-inverse', '--g-brand-bright', 4.5),
            ('--g-link', '--g-surface-card', 4.5),
            ('--status-error', '--g-surface-card', 4.5),
            ('--status-warning', '--g-surface-card', 3.0),
            ('--g-priority-p0', '--g-priority-p0-bg', 4.5),
            ('--g-priority-p1', '--g-priority-p1-bg', 4.5),
            ('--g-priority-p2', '--g-priority-p2-bg', 4.5),
            ('--g-priority-p3', '--g-priority-p3-bg', 4.5),
            ('--g-hitl-color', '--g-hitl-bg', 4.5),
            ('--g-input-color', '--g-input-bg', 4.5),
            ('--g-source-color', '--g-source-bg', 4.5),
            ('--g-kpi-color', '--g-kpi-bg', 4.5),
            ('--g-error-text', '--g-error-surface', 4.5),
        ]

    def get_color_rgb(self, token_name: str, bg_token: Optional[str] = None) -> Optional[Tuple[int, int, int]]:
        """Resolve token to RGB color."""
        if token_name not in self.tokens:
            return None

        value = TokenParser.resolve_var_reference(token_name, self.tokens)
        if not value:
            return None

        # For RGBA/HSLA with transparency, we need the background
        bg_rgb = None
        if bg_token:
            bg_value = TokenParser.resolve_var_reference(bg_token, self.tokens)
            if bg_value:
                bg_rgb = ColorConverter.parse_color(bg_value)

        return ColorConverter.parse_color(value, bg_rgb)

    def validate_contrast_pair(self, fg_token: str, bg_token: str, min_ratio: float) -> bool:
        """Validate contrast between two tokens."""
        fg_rgb = self.get_color_rgb(fg_token, bg_token)
        bg_rgb = self.get_color_rgb(bg_token)

        if not fg_rgb or not bg_rgb:
            symbol = '?'
            status = 'MISSING'
            ratio = 0
            passed = False
        else:
            ratio = WCAGValidator.contrast_ratio(fg_rgb, bg_rgb)
            passed = ratio >= min_ratio
            symbol = '✓' if passed else '✗'
            status = 'PASS' if passed else 'FAIL'
            if not passed:
                self.failed_count += 1

        result = {
            'fg': fg_token,
            'bg': bg_token,
            'min': min_ratio,
            'actual': ratio,
            'passed': passed,
            'symbol': symbol,
            'status': status
        }
        self.results.append(result)
        return passed

    def lint_tsx_files(self) -> List[Dict]:
        """Scan .tsx files for hardcoded hex colors."""
        warnings = []

        if not os.path.isdir(self.src_path):
            return warnings

        hex_pattern = re.compile(r'color\s*:\s*(["\']?)#[0-9a-fA-F]{3,6}\1')

        for root, dirs, files in os.walk(self.src_path):
            # Skip node_modules
            dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', 'dist']]

            for file in files:
                if file.endswith('.tsx'):
                    filepath = os.path.join(root, file)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            for line_num, line in enumerate(f, 1):
                                if hex_pattern.search(line):
                                    match = hex_pattern.search(line)
                                    hex_value = re.search(r'#[0-9a-fA-F]{3,6}', line).group(0)
                                    warnings.append({
                                        'file': filepath,
                                        'line': line_num,
                                        'color': hex_value,
                                        'text': line.strip()
                                    })
                    except (IOError, UnicodeDecodeError):
                        pass

        return warnings

    def print_results(self):
        """Print validation results in a clean format."""
        print('\n' + '='*70)
        print('WCAG AA Contrast Ratio Validation Report')
        print('='*70)

        print('\nColor Pair Contrast Ratios:')
        print('-'*70)

        for result in self.results:
            if result['passed']:
                status_str = f"{result['symbol']} {result['status']}"
            else:
                status_str = f"{result['symbol']} {result['status']}"

            ratio_str = f"{result['actual']:.2f}:1" if result['actual'] > 0 else "N/A"
            print(f"{status_str:10} {result['fg']:25} on {result['bg']:25} → {ratio_str:8} (min {result['min']}:1)")

        # Lint results
        tsx_warnings = self.lint_tsx_files()
        if tsx_warnings:
            print('\n' + '-'*70)
            print(f'Hardcoded Hex Colors in .tsx files ({len(tsx_warnings)} warnings):')
            print('-'*70)
            for warning in tsx_warnings:
                rel_path = os.path.relpath(warning['file'], self.src_path)
                print(f"⚠  {rel_path}:{warning['line']} — {warning['color']}")

        # Summary
        print('\n' + '='*70)
        if self.failed_count == 0:
            print(f"✓ PASS — All {len(self.results)} contrast checks passed")
            print('='*70)
            return True
        else:
            print(f"✗ FAIL — {self.failed_count}/{len(self.results)} contrast checks failed")
            print('='*70)
            return False


def main():
    """Main entry point."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)

    tokens_path = os.path.join(project_root, 'src/styles/tokens.css')
    src_path = os.path.join(project_root, 'src')

    validator = ContrastValidator(tokens_path, src_path)

    # Run all contrast pair validations
    for fg_token, bg_token, min_ratio in validator.contrast_pairs:
        validator.validate_contrast_pair(fg_token, bg_token, min_ratio)

    # Print results and determine exit code
    passed = validator.print_results()
    return 0 if passed else 1


if __name__ == '__main__':
    sys.exit(main())
