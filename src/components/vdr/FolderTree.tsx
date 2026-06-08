'use client';

import { useState, useCallback } from 'react';
import {
    ChevronRight, ChevronDown, FolderOpen, Folder, FolderPlus,
    Plus, Pencil, Trash2, FileText
} from 'lucide-react';
import type { VDRFolder } from '@/lib/supabase';

interface FolderTreeProps {
    folders: VDRFolder[];
    selectedFolderId: string | null;
    onSelectFolder: (id: string) => void;
    onCreateFolder: (parentId: string | null, name: string) => void;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    folderId: string;
}

function FolderNode({
    folder,
    children,
    docCount,
    isSelected,
    isExpanded,
    isDragOver,
    depth,
    onToggle,
    onSelect,
    onContextMenu,
    onDragOver,
    onDragLeave,
    onDrop,
}: {
    folder: VDRFolder;
    children: VDRFolder[];
    docCount: number;
    isSelected: boolean;
    isExpanded: boolean;
    isDragOver: boolean;
    depth: number;
    onToggle: (id: string) => void;
    onSelect: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onDragOver: (e: React.DragEvent, id: string) => void;
    onDragLeave: (id: string) => void;
    onDrop: (e: React.DragEvent, id: string) => void;
}) {
    const hasChildren = children.length > 0;

    return (
        <div>
            <button
                onClick={() => onSelect(folder.id)}
                onContextMenu={(e) => onContextMenu(e, folder.id)}
                onDragOver={(e) => onDragOver(e, folder.id)}
                onDragLeave={() => onDragLeave(folder.id)}
                onDrop={(e) => onDrop(e, folder.id)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--g-space-1)',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    paddingLeft: `${8 + depth * 16}px`,
                    borderRadius: 'var(--g-radius-sm)',
                    backgroundColor: isDragOver
                        ? 'color-mix(in srgb, var(--g-brand-3308) 15%, transparent)'
                        : isSelected
                            ? 'var(--g-sec-100)'
                            : 'transparent',
                    border: isDragOver ? '1px dashed var(--g-brand-3308)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s, border-color 0.15s',
                    fontSize: '12px',
                    lineHeight: '1.4',
                    fontWeight: isSelected ? 600 : 400,
                    color: 'var(--g-text-primary)',
                }}
            >
                {/* Expand/collapse toggle */}
                <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Contraer carpeta" : "Expandir carpeta"}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) onToggle(folder.id);
                    }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        flexShrink: 0,
                        opacity: hasChildren ? 1 : 0,
                        cursor: hasChildren ? 'pointer' : 'default',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                    }}
                >
                    {isExpanded ? (
                        <ChevronDown style={{ width: 12, height: 12, color: 'var(--g-text-secondary)' }} />
                    ) : (
                        <ChevronRight style={{ width: 12, height: 12, color: 'var(--g-text-secondary)' }} />
                    )}
                </button>

                {/* Folder icon */}
                {isExpanded ? (
                    <FolderOpen style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--g-brand-3308)' }} />
                ) : (
                    <Folder style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--g-brand-3308)' }} />
                )}

                {/* Folder name */}
                <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {folder.name}
                </span>

                {/* Area code color dot */}
                {folder.area_code && (
                    <span
                        title={folder.area_code}
                        style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: 'var(--g-brand-3308)',
                            flexShrink: 0,
                            opacity: 0.7,
                        }}
                    />
                )}

                {/* Doc count badge */}
                {docCount > 0 && (
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 18,
                        height: 16,
                        padding: '0 4px',
                        borderRadius: 'var(--g-radius-sm)',
                        backgroundColor: 'var(--g-surface-muted)',
                        color: 'var(--g-text-secondary)',
                        fontSize: '10px',
                        fontWeight: 600,
                        flexShrink: 0,
                    }}>
                        {docCount}
                    </span>
                )}
            </button>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div>
                    {children.map((child) => (
                        <RecursiveFolderNode
                            key={child.id}
                            folder={child}
                            depth={depth + 1}
                            allFolders={[]}
                            isSelected={false}
                            expandedIds={new Set()}
                            dragOverId={null}
                            docCountMap={{}}
                            onToggle={onToggle}
                            onSelect={onSelect}
                            onContextMenu={onContextMenu}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// This is the real recursive component used in the tree
function RecursiveFolderNode({
    folder,
    depth,
    allFolders,
    isSelected,
    expandedIds,
    dragOverId,
    docCountMap,
    onToggle,
    onSelect,
    onContextMenu,
    onDragOver,
    onDragLeave,
    onDrop,
}: {
    folder: VDRFolder;
    depth: number;
    allFolders: VDRFolder[];
    isSelected: boolean;
    expandedIds: Set<string>;
    dragOverId: string | null;
    docCountMap: Record<string, number>;
    onToggle: (id: string) => void;
    onSelect: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onDragOver: (e: React.DragEvent, id: string) => void;
    onDragLeave: (id: string) => void;
    onDrop: (e: React.DragEvent, id: string) => void;
}) {
    const children = allFolders.filter((f) => f.parent_id === folder.id);
    const isExpanded = expandedIds.has(folder.id);

    return (
        <FolderNode
            folder={folder}
            children={children}
            docCount={docCountMap[folder.id] || 0}
            isSelected={isSelected}
            isExpanded={isExpanded}
            isDragOver={dragOverId === folder.id}
            depth={depth}
            onToggle={onToggle}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        />
    );
}

export default function FolderTree({
    folders,
    selectedFolderId,
    onSelectFolder,
    onCreateFolder,
}: FolderTreeProps) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [inlineCreate, setInlineCreate] = useState<{ parentId: string | null } | null>(null);
    const [inlineValue, setInlineValue] = useState('');

    // Build a map of folder_id -> document count (basic, from folder data)
    const docCountMap: Record<string, number> = {};
    // This is a placeholder -- parent pages would pass doc counts. For now, count child folders as proxy.
    folders.forEach((f) => {
        if (f.parent_id) {
            docCountMap[f.parent_id] = (docCountMap[f.parent_id] || 0) + 1;
        }
    });

    const rootFolders = folders.filter((f) => !f.parent_id).sort((a, b) => a.sort_order - b.sort_order);

    const handleToggle = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent, folderId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, folderId });
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverId(id);
    }, []);

    const handleDragLeave = useCallback((_id: string) => {
        setDragOverId(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, _id: string) => {
        e.preventDefault();
        setDragOverId(null);
        // Parent component would handle the actual move via onDrop callback
    }, []);

    const handleInlineSubmit = useCallback(() => {
        const name = inlineValue.trim();
        if (name && inlineCreate) {
            onCreateFolder(inlineCreate.parentId, name);
        }
        setInlineCreate(null);
        setInlineValue('');
    }, [inlineValue, inlineCreate, onCreateFolder]);

    const handleInlineKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleInlineSubmit();
        } else if (e.key === 'Escape') {
            setInlineCreate(null);
            setInlineValue('');
        }
    }, [handleInlineSubmit]);

    const getChildFolders = (parentId: string) =>
        folders.filter((f) => f.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);

    const renderFolder = (folder: VDRFolder, depth: number) => {
        const children = getChildFolders(folder.id);
        const isExpanded = expandedIds.has(folder.id);
        const isSelected = selectedFolderId === folder.id;
        const hasChildren = children.length > 0;

        return (
            <div key={folder.id}>
                <button
                    onClick={() => onSelectFolder(folder.id)}
                    onContextMenu={(e) => handleContextMenu(e, folder.id)}
                    onDragOver={(e) => handleDragOver(e, folder.id)}
                    onDragLeave={() => handleDragLeave(folder.id)}
                    onDrop={(e) => handleDrop(e, folder.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-1)',
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        paddingLeft: `${8 + depth * 16}px`,
                        borderRadius: 'var(--g-radius-sm)',
                        backgroundColor: dragOverId === folder.id
                            ? 'color-mix(in srgb, var(--g-brand-3308) 15%, transparent)'
                            : isSelected
                                ? 'var(--g-sec-100)'
                                : 'transparent',
                        border: dragOverId === folder.id ? '1px dashed var(--g-brand-3308)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s, border-color 0.15s',
                        fontSize: '12px',
                        lineHeight: '1.4',
                        fontWeight: isSelected ? 600 : 400,
                        color: 'var(--g-text-primary)',
                    }}
                >
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            if (hasChildren) handleToggle(folder.id);
                        }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 16,
                            height: 16,
                            flexShrink: 0,
                            opacity: hasChildren ? 1 : 0.3,
                            cursor: hasChildren ? 'pointer' : 'default',
                        }}
                    >
                        {isExpanded ? (
                            <ChevronDown style={{ width: 12, height: 12, color: 'var(--g-text-secondary)' }} />
                        ) : (
                            <ChevronRight style={{ width: 12, height: 12, color: 'var(--g-text-secondary)' }} />
                        )}
                    </span>

                    {isExpanded ? (
                        <FolderOpen style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--g-brand-3308)' }} />
                    ) : (
                        <Folder style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--g-brand-3308)' }} />
                    )}

                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {folder.name}
                    </span>

                    {folder.area_code && (
                        <span
                            title={folder.area_code}
                            style={{
                                display: 'inline-block',
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: 'var(--g-brand-3308)',
                                flexShrink: 0,
                                opacity: 0.7,
                            }}
                        />
                    )}

                    {docCountMap[folder.id] && docCountMap[folder.id] > 0 && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 18,
                            height: 16,
                            padding: '0 4px',
                            borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: 'var(--g-surface-muted)',
                            color: 'var(--g-text-secondary)',
                            fontSize: '10px',
                            fontWeight: 600,
                            flexShrink: 0,
                        }}>
                            {docCountMap[folder.id]}
                        </span>
                    )}
                </button>

                {isExpanded && children.map((child) => renderFolder(child, depth + 1))}

                {/* Inline create inside this folder */}
                {inlineCreate && inlineCreate.parentId === folder.id && isExpanded && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--g-space-1)',
                        paddingLeft: `${8 + (depth + 1) * 16}px`,
                        paddingRight: 8,
                        paddingTop: 4,
                        paddingBottom: 4,
                    }}>
                        <FolderPlus style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--g-brand-3308)' }} />
                        <input
                            autoFocus
                            value={inlineValue}
                            onChange={(e) => setInlineValue(e.target.value)}
                            onKeyDown={handleInlineKeyDown}
                            onBlur={handleInlineSubmit}
                            placeholder="Nombre carpeta..."
                            style={{
                                flex: 1,
                                height: 24,
                                padding: '0 6px',
                                fontSize: '11px',
                                border: '1px solid var(--g-border-default)',
                                borderRadius: 'var(--g-radius-sm)',
                                backgroundColor: 'var(--g-surface-card)',
                                color: 'var(--g-text-primary)',
                                outline: 'none',
                            }}
                        />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            onClick={closeContextMenu}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                position: 'relative',
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--g-space-2)',
            }}>
                <span style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--g-text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}>
                    Carpetas
                </span>
                <button
                    onClick={() => {
                        setInlineCreate({ parentId: null });
                        setInlineValue('');
                    }}
                    title="Nueva carpeta raiz"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: 'var(--g-radius-sm)',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--g-text-secondary)',
                        cursor: 'pointer',
                        transition: 'color 0.15s',
                    }}
                >
                    <Plus style={{ width: 14, height: 14 }} />
                </button>
            </div>

            {/* "All documents" root entry */}
            <button
                onClick={() => onSelectFolder('')}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--g-space-1)',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    borderRadius: 'var(--g-radius-sm)',
                    backgroundColor: selectedFolderId === null || selectedFolderId === '' ? 'var(--g-sec-100)' : 'transparent',
                    border: '1px solid transparent',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: selectedFolderId === null || selectedFolderId === '' ? 600 : 400,
                    color: 'var(--g-text-primary)',
                }}
            >
                <FolderOpen style={{ width: 14, height: 14, color: 'var(--g-text-secondary)' }} />
                <span>Todos los documentos</span>
            </button>

            {/* Root inline create */}
            {inlineCreate && inlineCreate.parentId === null && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--g-space-1)',
                    padding: '4px 8px',
                }}>
                    <FolderPlus style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--g-brand-3308)' }} />
                    <input
                        autoFocus
                        value={inlineValue}
                        onChange={(e) => setInlineValue(e.target.value)}
                        onKeyDown={handleInlineKeyDown}
                        onBlur={handleInlineSubmit}
                        placeholder="Nombre carpeta..."
                        style={{
                            flex: 1,
                            height: 24,
                            padding: '0 6px',
                            fontSize: '11px',
                            border: '1px solid var(--g-border-default)',
                            borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: 'var(--g-surface-card)',
                            color: 'var(--g-text-primary)',
                            outline: 'none',
                        }}
                    />
                </div>
            )}

            {/* Folder tree */}
            {rootFolders.map((folder) => renderFolder(folder, 0))}

            {/* Empty state */}
            {rootFolders.length === 0 && !inlineCreate && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: 'var(--g-space-6) var(--g-space-3)',
                    color: 'var(--g-text-secondary)',
                    fontSize: '12px',
                    textAlign: 'center',
                }}>
                    <Folder style={{ width: 24, height: 24, marginBottom: 'var(--g-space-2)', opacity: 0.3 }} />
                    <span>Sin carpetas creadas</span>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && contextMenu.visible && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 999,
                        minWidth: 160,
                        padding: 'var(--g-space-1)',
                        backgroundColor: 'var(--g-surface-card)',
                        border: '1px solid var(--g-border-default)',
                        borderRadius: 'var(--g-radius-md)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                >
                    {[
                        { icon: FolderPlus, label: 'Nueva subcarpeta', action: 'subfolder' },
                        { icon: Pencil, label: 'Renombrar', action: 'rename' },
                        { icon: Trash2, label: 'Eliminar', action: 'delete' },
                    ].map((item) => (
                        <button
                            key={item.action}
                            onClick={() => {
                                if (item.action === 'subfolder') {
                                    setExpandedIds((prev) => { const arr = Array.from(prev); arr.push(contextMenu.folderId); return new Set(arr); });
                                    setInlineCreate({ parentId: contextMenu.folderId });
                                    setInlineValue('');
                                }
                                // rename and delete would be handled by parent in a real app
                                closeContextMenu();
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--g-space-2)',
                                width: '100%',
                                textAlign: 'left',
                                padding: '6px 10px',
                                borderRadius: 'var(--g-radius-sm)',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: item.action === 'delete' ? 'var(--status-error)' : 'var(--g-text-primary)',
                                fontSize: '12px',
                                cursor: 'pointer',
                            }}
                        >
                            <item.icon style={{ width: 13, height: 13 }} />
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
