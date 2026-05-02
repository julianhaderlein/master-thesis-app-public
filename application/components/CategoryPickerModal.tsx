import React from 'react';
import { Colors } from '@/constants/theme';
import { View, Text, Modal, Pressable, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Category } from '@/db/schema/category';
import { formatCategoryLabel } from '@/services/category-utils';

interface CategoryPickerModalProps {
  visible: boolean;
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}

export function CategoryPickerModal({
  visible,
  categories,
  selectedId,
  onSelect,
  onClose,
}: CategoryPickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Select Category</Text>

          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            style={styles.list}
            ListHeaderComponent={
              <Pressable
                style={[styles.row, selectedId === null && styles.rowSelected]}
                onPress={() => { onSelect(null); onClose(); }}
              >
                <View style={[styles.colorSwatch, { backgroundColor: Colors.divider }]} />
                <Ionicons name="close-circle-outline" size={20} color="#999" style={styles.icon} />
                <Text style={[styles.rowLabel, selectedId === null && styles.rowLabelSelected]}>
                  None
                </Text>
                {selectedId === null && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </Pressable>
            }
            renderItem={({ item }) => {
              const isSelected = selectedId === item.id;
              return (
                <Pressable
                  style={[styles.row, isSelected && styles.rowSelected]}
                  onPress={() => { onSelect(item.id); onClose(); }}
                >
                  <View style={[styles.colorSwatch, { backgroundColor: item.color ?? Colors.divider }]} />
                  <Ionicons
                    name={(item.icon as any) ?? 'ellipsis-horizontal-outline'}
                    size={20}
                    color={item.color ?? Colors.textMuted}
                    style={styles.icon}
                  />
                  <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>
                    {formatCategoryLabel(item.id)}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </Pressable>
              );
            }}
          />

          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
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
    maxHeight: 380,
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
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  icon: {
    width: 24,
    textAlign: 'center',
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
  footer: {
    marginTop: 16,
  },
  cancelButton: {
    backgroundColor: Colors.white,
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
});
