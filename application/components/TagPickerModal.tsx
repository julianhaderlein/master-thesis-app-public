import React, { useState, useEffect } from 'react';
import { Colors } from '@/constants/theme';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Tag } from '@/db/schema/tag';
import { colorForSlug } from '@/services/tag-utils';

interface TagPickerModalProps {
  visible: boolean;
  tags: Tag[];
  selectedIds: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
  /** Create a tag by name; returns the new tag's slug ID */
  onCreateTag: (name: string) => Promise<string>;
}

export function TagPickerModal({
  visible,
  tags,
  selectedIds,
  onSave,
  onClose,
  onCreateTag,
}: TagPickerModalProps) {
  const [toggled, setToggled] = useState<Set<string>>(new Set(selectedIds));
  const [newTagName, setNewTagName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  // Sync external selectedIds when modal opens
  useEffect(() => {
    if (visible) {
      setToggled(new Set(selectedIds));
      setNewTagName('');
      setShowNewForm(false);
    }
  }, [visible]);

  const handleToggle = (id: string) => {
    setToggled(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    try {
      const id = await onCreateTag(trimmed);
      setToggled(prev => new Set([...prev, id]));
      setNewTagName('');
      setShowNewForm(false);
    } catch (e) {
      console.error('[TagPickerModal] create tag error', e);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Select Tags</Text>

          <FlatList
            data={tags}
            keyExtractor={(item) => item.id}
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No tags yet — create one below</Text>
            }
            renderItem={({ item }) => {
              const isSelected = toggled.has(item.id);
              return (
                <Pressable
                  style={[styles.row, isSelected && styles.rowSelected]}
                  onPress={() => handleToggle(item.id)}
                >
                  <View
                    style={[
                      styles.colorDot,
                      { backgroundColor: item.color ?? colorForSlug(item.id) },
                    ]}
                  />
                  <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>
                    {item.name}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </Pressable>
              );
            }}
          />

          {/* Inline new tag form */}
          {showNewForm ? (
            <View style={styles.newTagForm}>
              <TextInput
                style={styles.newTagInput}
                value={newTagName}
                onChangeText={setNewTagName}
                placeholder="Tag name"
                placeholderTextColor="#999"
                autoFocus
              />
              <Pressable style={styles.newTagConfirm} onPress={handleAddTag}>
                <Ionicons name="add" size={20} color="#fff" />
              </Pressable>
              <Pressable onPress={() => { setShowNewForm(false); setNewTagName(''); }}>
                <Ionicons name="close" size={20} color="#999" />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.newTagRow} onPress={() => setShowNewForm(true)}>
              <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
              <Text style={styles.newTagRowText}>New tag</Text>
            </Pressable>
          )}

          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={() => onSave(Array.from(toggled))}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  list: {
    maxHeight: 320,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textPlaceholder,
    paddingVertical: 16,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
    gap: 10,
  },
  rowSelected: {
    backgroundColor: Colors.primarySubtle,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    flexShrink: 0,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  rowLabelSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  newTagForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  newTagInput: {
    flex: 1,
    backgroundColor: Colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
  },
  newTagConfirm: {
    backgroundColor: Colors.primary,
    padding: 8,
    borderRadius: 8,
  },
  newTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginTop: 4,
  },
  newTagRowText: {
    fontSize: 15,
    color: Colors.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
