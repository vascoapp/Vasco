// =============================================================================
// DOCUMENT VAULT COMPONENT
// =============================================================================
// Secure document management with smart categorization and sharing
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useDocuments,
  useExpiringDocuments,
  useDocumentStats,
  useDocumentFolders,
  useDocumentTemplates,
  Document,
  DocumentType,
  ExpiringDocument,
  DocumentTemplate,
} from '../../services/documentVaultService';

type TabType = 'all' | 'expiring' | 'folders' | 'templates';

export function DocumentVault() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const { documents, upload, deleteDoc, share } = useDocuments(
    searchQuery ? { query: searchQuery } : selectedType ? { type: selectedType } : undefined
  );
  const expiringDocuments = useExpiringDocuments(60);
  const stats = useDocumentStats();
  const { folders, createFolder } = useDocumentFolders();
  const templates = useDocumentTemplates();

  const tabs: Array<{ key: TabType; label: string; icon: string; badge?: number }> = [
    { key: 'all', label: 'Alle', icon: 'folder-outline' },
    { key: 'expiring', label: 'Verloopt', icon: 'alert-circle-outline', badge: expiringDocuments.length },
    { key: 'folders', label: 'Mappen', icon: 'albums-outline' },
    { key: 'templates', label: 'Templates', icon: 'document-outline' },
  ];

  const documentTypes: Array<{ type: DocumentType; label: string; icon: string }> = [
    { type: 'contract', label: 'Contracten', icon: 'document-text-outline' },
    { type: 'quote', label: 'Offertes', icon: 'pricetag-outline' },
    { type: 'invoice', label: 'Facturen', icon: 'receipt-outline' },
    { type: 'warranty', label: 'Garanties', icon: 'shield-checkmark-outline' },
    { type: 'certification', label: 'Certificaten', icon: 'ribbon-outline' },
    { type: 'photo_before', label: 'Foto\'s', icon: 'camera-outline' },
  ];

  const getTypeStyle = (type: DocumentType) => {
    const styles: Record<string, { color: string; icon: string }> = {
      contract: { color: Palette.blue500, icon: 'document-text' },
      quote: { color: Palette.hermesOrange, icon: 'pricetag' },
      invoice: { color: Palette.green500, icon: 'receipt' },
      warranty: { color: Palette.orange500, icon: 'shield-checkmark' },
      certification: { color: Palette.red500, icon: 'ribbon' },
      insurance: { color: Palette.blue500, icon: 'umbrella' },
      permit: { color: Palette.hermesOrange, icon: 'document-attach' },
      photo_before: { color: Palette.orange500, icon: 'camera' },
      photo_after: { color: Palette.green500, icon: 'camera' },
      photo_progress: { color: Palette.blue500, icon: 'camera' },
      receipt: { color: Palette.gray500, icon: 'receipt' },
      specification: { color: Palette.hermesOrange, icon: 'list' },
      floor_plan: { color: Palette.blue500, icon: 'map' },
      other: { color: Palette.gray500, icon: 'document' },
    };
    return styles[type] || styles.other;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const openDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setShowDocumentModal(true);
  };

  const renderDocumentCard = (doc: Document) => {
    const typeStyle = getTypeStyle(doc.type);
    const isImage = doc.mimeType.startsWith('image/');

    return (
      <Pressable key={doc.id} style={styles.documentCard} onPress={() => openDocument(doc)}>
        <View style={[styles.documentIcon, { backgroundColor: typeStyle.color + '15' }]}>
          <Ionicons name={typeStyle.icon as any} size={24} color={typeStyle.color} />
        </View>
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={1}>{doc.name}</Text>
          <View style={styles.documentMeta}>
            <Text style={styles.documentDate}>{formatDate(doc.uploadedAt)}</Text>
            <Text style={styles.documentSize}>{formatSize(doc.size)}</Text>
          </View>
          <View style={styles.documentTags}>
            {doc.tags.slice(0, 2).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {doc.tags.length > 2 && (
              <Text style={styles.moreTags}>+{doc.tags.length - 2}</Text>
            )}
          </View>
        </View>
        <View style={styles.documentActions}>
          {doc.shared && (
            <Ionicons name="share-social" size={16} color={Palette.blue500} />
          )}
          {doc.expiresAt && (
            <Ionicons name="time-outline" size={16} color={Palette.orange500} />
          )}
        </View>
      </Pressable>
    );
  };

  const renderAllTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={SemanticColors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Zoek documenten..."
          placeholderTextColor={SemanticColors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={SemanticColors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Type Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeFilter}>
        <Pressable
          style={[styles.typeChip, !selectedType && styles.typeChipActive]}
          onPress={() => setSelectedType(null)}
        >
          <Text style={[styles.typeChipText, !selectedType && styles.typeChipTextActive]}>Alle</Text>
        </Pressable>
        {documentTypes.map((dt) => (
          <Pressable
            key={dt.type}
            style={[styles.typeChip, selectedType === dt.type && styles.typeChipActive]}
            onPress={() => setSelectedType(selectedType === dt.type ? null : dt.type)}
          >
            <Ionicons
              name={dt.icon as any}
              size={14}
              color={selectedType === dt.type ? '#fff' : SemanticColors.textSecondary}
            />
            <Text style={[styles.typeChipText, selectedType === dt.type && styles.typeChipTextActive]}>
              {dt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalDocuments}</Text>
          <Text style={styles.statLabel}>Documenten</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatSize(stats.totalSize)}</Text>
          <Text style={styles.statLabel}>Opslag</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: stats.expiringCount > 0 ? Palette.orange500 : Palette.green500 }]}>
            {stats.expiringCount}
          </Text>
          <Text style={styles.statLabel}>Verloopt</Text>
        </View>
      </View>

      {/* Documents List */}
      <Text style={styles.sectionTitle}>
        {searchQuery ? 'Zoekresultaten' : selectedType ? documentTypes.find((d) => d.type === selectedType)?.label : 'Recente documenten'}
      </Text>
      {documents.map(renderDocumentCard)}

      {documents.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyTitle}>Geen documenten gevonden</Text>
          <Text style={styles.emptyText}>Pas je filters aan of upload nieuwe documenten</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderExpiringCard = (item: ExpiringDocument) => {
    const urgencyStyle = {
      critical: { color: Palette.red500, bg: Palette.red500 + '15', icon: 'alert-circle' },
      warning: { color: Palette.orange500, bg: Palette.orange500 + '15', icon: 'warning' },
      info: { color: Palette.blue500, bg: Palette.blue500 + '15', icon: 'information-circle' },
    }[item.urgency];

    return (
      <Pressable
        key={item.document.id}
        style={[styles.expiringCard, { borderLeftColor: urgencyStyle.color }]}
        onPress={() => openDocument(item.document)}
      >
        <View style={[styles.urgencyIcon, { backgroundColor: urgencyStyle.bg }]}>
          <Ionicons name={urgencyStyle.icon as any} size={20} color={urgencyStyle.color} />
        </View>
        <View style={styles.expiringInfo}>
          <Text style={styles.expiringName}>{item.document.name}</Text>
          <Text style={[styles.expiringDays, { color: urgencyStyle.color }]}>
            {item.daysUntilExpiry <= 0
              ? 'VERLOPEN'
              : `Verloopt over ${item.daysUntilExpiry} dag${item.daysUntilExpiry !== 1 ? 'en' : ''}`}
          </Text>
          <Text style={styles.expiringAction}>{item.actionRequired}</Text>
        </View>
        <Pressable style={styles.renewButton}>
          <Text style={styles.renewText}>Vernieuw</Text>
        </Pressable>
      </Pressable>
    );
  };

  const renderExpiringTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {expiringDocuments.length > 0 ? (
        <>
          <View style={styles.expiringHeader}>
            <Ionicons name="alert-circle-outline" size={20} color={Palette.orange500} />
            <Text style={styles.expiringHeaderText}>
              {expiringDocuments.length} document{expiringDocuments.length !== 1 ? 'en' : ''} verlo
              {expiringDocuments.length !== 1 ? 'pen' : 'opt'} binnen 60 dagen
            </Text>
          </View>

          {expiringDocuments.map(renderExpiringCard)}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={48} color={Palette.green500} />
          <Text style={styles.emptyTitle}>Alles up-to-date!</Text>
          <Text style={styles.emptyText}>Er zijn geen documenten die binnenkort verlopen</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderFolderCard = (folder: typeof folders[0]) => (
    <Pressable key={folder.id} style={styles.folderCard}>
      <View style={[styles.folderIcon, { backgroundColor: folder.color || Palette.gray500 }]}>
        <Ionicons name="folder" size={24} color="#fff" />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName}>{folder.name}</Text>
        <Text style={styles.folderCount}>{folder.documentCount} documenten</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={SemanticColors.textSecondary} />
    </Pressable>
  );

  const renderFoldersTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {folders.map(renderFolderCard)}

      <Pressable style={styles.addFolderButton}>
        <Ionicons name="add-circle-outline" size={24} color={Palette.blue500} />
        <Text style={styles.addFolderText}>Nieuwe map maken</Text>
      </Pressable>
    </ScrollView>
  );

  const renderTemplateCard = (template: DocumentTemplate) => (
    <Pressable key={template.id} style={styles.templateCard}>
      <View style={styles.templatePreview}>
        <Ionicons name="document-outline" size={32} color={Palette.hermesOrange} />
      </View>
      <View style={styles.templateInfo}>
        <Text style={styles.templateName}>{template.name}</Text>
        <Text style={styles.templateDesc}>{template.description}</Text>
        <View style={styles.templateFields}>
          <Ionicons name="list-outline" size={14} color={SemanticColors.textSecondary} />
          <Text style={styles.templateFieldsText}>{template.fields.length} velden</Text>
        </View>
      </View>
      <Pressable style={styles.useTemplateButton}>
        <Text style={styles.useTemplateText}>Gebruik</Text>
      </Pressable>
    </Pressable>
  );

  const renderTemplatesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Document templates</Text>
      <Text style={styles.sectionSubtitle}>
        Genereer professionele documenten met één klik
      </Text>

      {templates.map(renderTemplateCard)}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <View style={styles.tabIconContainer}>
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.key ? Palette.blue500 : SemanticColors.textSecondary}
              />
              {tab.badge && tab.badge > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'all' && renderAllTab()}
      {activeTab === 'expiring' && renderExpiringTab()}
      {activeTab === 'folders' && renderFoldersTab()}
      {activeTab === 'templates' && renderTemplatesTab()}

      {/* Upload Button */}
      <Pressable style={styles.uploadButton}>
        <Ionicons name="cloud-upload-outline" size={28} color="#fff" />
      </Pressable>

      {/* Document Modal */}
      <Modal
        visible={showDocumentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDocumentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowDocumentModal(false)}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>Document</Text>
            <Pressable>
              <Ionicons name="ellipsis-horizontal" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
          </View>

          {selectedDocument && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.docDetailHeader}>
                <View style={[styles.docDetailIcon, { backgroundColor: getTypeStyle(selectedDocument.type).color + '15' }]}>
                  <Ionicons
                    name={getTypeStyle(selectedDocument.type).icon as any}
                    size={32}
                    color={getTypeStyle(selectedDocument.type).color}
                  />
                </View>
                <Text style={styles.docDetailName}>{selectedDocument.name}</Text>
                <Text style={styles.docDetailSize}>{formatSize(selectedDocument.size)}</Text>
              </View>

              <View style={styles.docDetailSection}>
                <View style={styles.docDetailRow}>
                  <Text style={styles.docDetailLabel}>Geüpload</Text>
                  <Text style={styles.docDetailValue}>{formatDate(selectedDocument.uploadedAt)}</Text>
                </View>
                {selectedDocument.expiresAt && (
                  <View style={styles.docDetailRow}>
                    <Text style={styles.docDetailLabel}>Verloopt</Text>
                    <Text style={[styles.docDetailValue, { color: Palette.orange500 }]}>
                      {formatDate(selectedDocument.expiresAt)}
                    </Text>
                  </View>
                )}
                {selectedDocument.projectId && (
                  <View style={styles.docDetailRow}>
                    <Text style={styles.docDetailLabel}>Project</Text>
                    <Text style={styles.docDetailValue}>Gekoppeld project</Text>
                  </View>
                )}
              </View>

              <View style={styles.docDetailTags}>
                <Text style={styles.docDetailLabel}>Tags</Text>
                <View style={styles.tagsList}>
                  {selectedDocument.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.docActions}>
                <Pressable style={styles.docActionButton}>
                  <Ionicons name="eye-outline" size={20} color={Palette.blue500} />
                  <Text style={styles.docActionText}>Bekijken</Text>
                </Pressable>
                <Pressable style={styles.docActionButton}>
                  <Ionicons name="share-outline" size={20} color={Palette.blue500} />
                  <Text style={styles.docActionText}>Delen</Text>
                </Pressable>
                <Pressable style={styles.docActionButton}>
                  <Ionicons name="download-outline" size={20} color={Palette.blue500} />
                  <Text style={styles.docActionText}>Download</Text>
                </Pressable>
                <Pressable style={[styles.docActionButton, { borderColor: Palette.red500 }]}>
                  <Ionicons name="trash-outline" size={20} color={Palette.red500} />
                  <Text style={[styles.docActionText, { color: Palette.red500 }]}>Verwijder</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  activeTab: {
    backgroundColor: Palette.blue500 + '15',
  },
  tabIconContainer: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Palette.red500,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  tabText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Palette.blue500,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 15,
    color: SemanticColors.textPrimary,
  },

  // Type Filter
  typeFilter: {
    marginBottom: 16,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginRight: 8,
    gap: 6,
  },
  typeChipActive: {
    backgroundColor: Palette.blue500,
    borderColor: Palette.blue500,
  },
  typeChipText: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  typeChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginBottom: 16,
  },

  // Document Card
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  documentMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  documentDate: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  documentSize: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  documentTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  tag: {
    backgroundColor: SemanticColors.surfaceBackground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
  },
  moreTags: {
    fontSize: 10,
    color: Palette.blue500,
  },
  documentActions: {
    flexDirection: 'row',
    gap: 8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },

  // Expiring
  expiringHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.orange500 + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  expiringHeaderText: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.textPrimary,
  },
  expiringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderLeftWidth: 4,
    gap: 12,
  },
  urgencyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiringInfo: {
    flex: 1,
  },
  expiringName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  expiringDays: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  expiringAction: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  renewButton: {
    backgroundColor: Palette.blue500,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  renewText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Folders
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  folderIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  folderCount: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  addFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.blue500 + '15',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.blue500,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 8,
  },
  addFolderText: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.blue500,
  },

  // Templates
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  templatePreview: {
    width: 56,
    height: 72,
    backgroundColor: Palette.hermesOrange + '15',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  templateDesc: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  templateFields: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  templateFieldsText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  useTemplateButton: {
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  useTemplateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Upload Button
  uploadButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Palette.blue500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  docDetailHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  docDetailIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  docDetailName: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },
  docDetailSize: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  docDetailSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  docDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  docDetailLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  docDetailValue: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
    fontWeight: '500',
  },
  docDetailTags: {
    marginBottom: 24,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  docActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  docActionButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.blue500,
    gap: 8,
  },
  docActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.blue500,
  },
});
