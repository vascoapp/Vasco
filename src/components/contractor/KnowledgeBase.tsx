// =============================================================================
// KNOWLEDGE BASE & LEARNING CENTER COMPONENT
// =============================================================================
// Personalized learning content based on contractor's projects and skill gaps
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useKnowledgeBase,
  useIndustryUpdates,
  Article,
  Tutorial,
  LearningPath,
  SkillAssessment,
} from '../../services/knowledgeBaseService';

type TabType = 'recommended' | 'articles' | 'tutorials' | 'updates';

export function KnowledgeBase() {
  const [activeTab, setActiveTab] = useState<TabType>('recommended');
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    articles,
    tutorials,
    recommended,
    skillAssessment,
    learningPaths,
    markArticleRead,
    bookmarkArticle,
  } = useKnowledgeBase();

  const { updates, markRead, unreadCount } = useIndustryUpdates();

  const tabs: Array<{ key: TabType; label: string; icon: string; badge?: number }> = [
    { key: 'recommended', label: 'Voor jou', icon: 'star-outline' },
    { key: 'articles', label: 'Artikelen', icon: 'document-text-outline' },
    { key: 'tutorials', label: 'Tutorials', icon: 'play-circle-outline' },
    { key: 'updates', label: 'Updates', icon: 'newspaper-outline', badge: unreadCount },
  ];

  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return { color: Palette.emerald, label: 'Beginner' };
      case 'intermediate': return { color: Palette.orange, label: 'Gemiddeld' };
      case 'advanced': return { color: Palette.red, label: 'Gevorderd' };
      default: return { color: Palette.gray, label: difficulty };
    }
  };

  const getSkillLevelStyle = (level: string) => {
    const levels: Record<string, { color: string; width: number }> = {
      none: { color: Palette.gray, width: 0 },
      beginner: { color: Palette.red, width: 25 },
      intermediate: { color: Palette.orange, width: 50 },
      advanced: { color: Palette.blue, width: 75 },
      expert: { color: Palette.emerald, width: 100 },
    };
    return levels[level] || levels.none;
  };

  const openArticle = (article: Article) => {
    setSelectedArticle(article);
    setShowArticleModal(true);
    markArticleRead(article.id);
  };

  const renderSkillCard = (skill: SkillAssessment) => {
    const levelStyle = getSkillLevelStyle(skill.level);
    return (
      <View key={skill.skill} style={styles.skillCard}>
        <View style={styles.skillHeader}>
          <Text style={styles.skillName}>{skill.skill}</Text>
          <Text style={[styles.skillLevel, { color: levelStyle.color }]}>
            {skill.level.charAt(0).toUpperCase() + skill.level.slice(1)}
          </Text>
        </View>
        <View style={styles.skillBar}>
          <View style={[styles.skillFill, { width: `${levelStyle.width}%`, backgroundColor: levelStyle.color }]} />
        </View>
        <Text style={styles.skillBasis}>Gebaseerd op: {skill.basedOn}</Text>
      </View>
    );
  };

  const renderLearningPathCard = (path: LearningPath) => (
    <TouchableOpacity key={path.id} style={styles.pathCard}>
      <View style={styles.pathHeader}>
        <View style={styles.pathIcon}>
          <Ionicons name="school-outline" size={24} color={Palette.purple} />
        </View>
        <View style={styles.pathInfo}>
          <Text style={styles.pathTitle}>{path.title}</Text>
          <Text style={styles.pathDescription}>{path.description}</Text>
        </View>
      </View>
      <View style={styles.pathProgress}>
        <View style={styles.pathProgressBar}>
          <View style={[styles.pathProgressFill, { width: `${path.progress}%` }]} />
        </View>
        <Text style={styles.pathProgressText}>{path.progress}%</Text>
      </View>
      <View style={styles.pathMeta}>
        <View style={styles.pathMetaItem}>
          <Ionicons name="time-outline" size={14} color={SemanticColors.textSecondary} />
          <Text style={styles.pathMetaText}>{path.estimatedTime} min</Text>
        </View>
        <View style={styles.pathMetaItem}>
          <Ionicons name="document-text-outline" size={14} color={SemanticColors.textSecondary} />
          <Text style={styles.pathMetaText}>{path.articles.length} artikelen</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderRecommendedTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Skill Assessment */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Jouw vaardigheden</Text>
        <TouchableOpacity>
          <Text style={styles.seeAllText}>Bekijk alle</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.skillsScroll}>
        {skillAssessment.map(renderSkillCard)}
      </ScrollView>

      {/* Learning Paths */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Aanbevolen leerpaden</Text>
      </View>
      {learningPaths.map(renderLearningPathCard)}

      {/* Recommended Articles */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Artikelen voor jou</Text>
      </View>
      {recommended.slice(0, 3).map((article) => (
        <TouchableOpacity
          key={article.id}
          style={styles.articleCard}
          onPress={() => openArticle(article)}
        >
          <View style={styles.articleContent}>
            <Text style={styles.articleTitle}>{article.title}</Text>
            <Text style={styles.articleSummary} numberOfLines={2}>
              {article.summary}
            </Text>
            <View style={styles.articleMeta}>
              <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyStyle(article.difficulty).color + '20' }]}>
                <Text style={[styles.difficultyText, { color: getDifficultyStyle(article.difficulty).color }]}>
                  {getDifficultyStyle(article.difficulty).label}
                </Text>
              </View>
              <View style={styles.articleMetaItem}>
                <Ionicons name="time-outline" size={12} color={SemanticColors.textSecondary} />
                <Text style={styles.articleMetaText}>{article.readTime} min</Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={SemanticColors.textSecondary} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderArticlesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={SemanticColors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Zoek artikelen..."
          placeholderTextColor={SemanticColors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={SemanticColors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
        {['Alle', 'Regelgeving', 'Materialen', 'Business', 'Technieken'].map((cat) => (
          <TouchableOpacity key={cat} style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Articles List */}
      {articles.map((article) => (
        <TouchableOpacity
          key={article.id}
          style={styles.articleCard}
          onPress={() => openArticle(article)}
        >
          <View style={styles.articleContent}>
            <View style={styles.articleHeader}>
              <Text style={styles.articleCategory}>{article.category}</Text>
              {article.bookmarked && (
                <Ionicons name="bookmark" size={16} color={Palette.blue} />
              )}
            </View>
            <Text style={styles.articleTitle}>{article.title}</Text>
            <Text style={styles.articleSummary} numberOfLines={2}>
              {article.summary}
            </Text>
            <View style={styles.articleMeta}>
              <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyStyle(article.difficulty).color + '20' }]}>
                <Text style={[styles.difficultyText, { color: getDifficultyStyle(article.difficulty).color }]}>
                  {getDifficultyStyle(article.difficulty).label}
                </Text>
              </View>
              <View style={styles.articleMetaItem}>
                <Ionicons name="time-outline" size={12} color={SemanticColors.textSecondary} />
                <Text style={styles.articleMetaText}>{article.readTime} min</Text>
              </View>
              <View style={styles.articleMetaItem}>
                <Ionicons name="eye-outline" size={12} color={SemanticColors.textSecondary} />
                <Text style={styles.articleMetaText}>{article.views}</Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={SemanticColors.textSecondary} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderTutorialCard = (tutorial: Tutorial) => {
    const difficultyStyle = getDifficultyStyle(tutorial.difficulty);
    return (
      <TouchableOpacity key={tutorial.id} style={styles.tutorialCard}>
        <View style={styles.tutorialHeader}>
          <View style={styles.tutorialIcon}>
            <Ionicons name="play-circle" size={32} color={Palette.blue} />
            {tutorial.progress > 0 && tutorial.progress < 100 && (
              <View style={styles.tutorialProgressRing}>
                <Text style={styles.tutorialProgressText}>{tutorial.progress}%</Text>
              </View>
            )}
            {tutorial.progress === 100 && (
              <View style={styles.tutorialCompleteIcon}>
                <Ionicons name="checkmark-circle" size={16} color={Palette.emerald} />
              </View>
            )}
          </View>
          <View style={styles.tutorialInfo}>
            <Text style={styles.tutorialTitle}>{tutorial.title}</Text>
            <Text style={styles.tutorialDescription} numberOfLines={2}>
              {tutorial.description}
            </Text>
          </View>
        </View>

        <View style={styles.tutorialMeta}>
          <View style={[styles.difficultyBadge, { backgroundColor: difficultyStyle.color + '20' }]}>
            <Text style={[styles.difficultyText, { color: difficultyStyle.color }]}>
              {difficultyStyle.label}
            </Text>
          </View>
          <View style={styles.tutorialMetaItem}>
            <Ionicons name="time-outline" size={14} color={SemanticColors.textSecondary} />
            <Text style={styles.tutorialMetaText}>{tutorial.duration} min</Text>
          </View>
          <View style={styles.tutorialMetaItem}>
            <Ionicons name="list-outline" size={14} color={SemanticColors.textSecondary} />
            <Text style={styles.tutorialMetaText}>{tutorial.steps.length} stappen</Text>
          </View>
        </View>

        {tutorial.progress > 0 && (
          <View style={styles.tutorialProgressBar}>
            <View style={[styles.tutorialProgressFill, { width: `${tutorial.progress}%` }]} />
          </View>
        )}

        {tutorial.skillsGained.length > 0 && (
          <View style={styles.skillsGained}>
            <Text style={styles.skillsGainedLabel}>Je leert:</Text>
            <View style={styles.skillsGainedList}>
              {tutorial.skillsGained.map((skill, index) => (
                <View key={index} style={styles.skillGainedChip}>
                  <Text style={styles.skillGainedText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderTutorialsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* In Progress */}
      {tutorials.some((t) => t.progress > 0 && t.progress < 100) && (
        <>
          <Text style={styles.sectionTitle}>Bezig</Text>
          {tutorials
            .filter((t) => t.progress > 0 && t.progress < 100)
            .map(renderTutorialCard)}
        </>
      )}

      {/* All Tutorials */}
      <Text style={styles.sectionTitle}>Alle tutorials</Text>
      {tutorials.map(renderTutorialCard)}
    </ScrollView>
  );

  const getCategoryStyle = (category: string) => {
    switch (category) {
      case 'regelgeving': return { color: Palette.red, icon: 'document-text' };
      case 'markt': return { color: Palette.blue, icon: 'trending-up' };
      case 'technologie': return { color: Palette.purple, icon: 'hardware-chip' };
      case 'materialen': return { color: Palette.orange, icon: 'cube' };
      default: return { color: Palette.gray, icon: 'newspaper' };
    }
  };

  const renderUpdatesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {updates.map((update) => {
        const categoryStyle = getCategoryStyle(update.category);
        return (
          <TouchableOpacity
            key={update.id}
            style={[styles.updateCard, !update.read && styles.updateCardUnread]}
            onPress={() => markRead(update.id)}
          >
            <View style={[styles.updateIcon, { backgroundColor: categoryStyle.color + '20' }]}>
              <Ionicons name={categoryStyle.icon as any} size={20} color={categoryStyle.color} />
            </View>
            <View style={styles.updateContent}>
              <View style={styles.updateHeader}>
                <Text style={styles.updateTitle}>{update.title}</Text>
                {update.importance === 'high' && (
                  <View style={styles.importanceBadge}>
                    <Ionicons name="alert-circle" size={12} color={Palette.red} />
                  </View>
                )}
              </View>
              <Text style={styles.updateSummary} numberOfLines={2}>{update.summary}</Text>
              <View style={styles.updateMeta}>
                <Text style={styles.updateSource}>{update.source}</Text>
                <Text style={styles.updateDate}>
                  {new Date(update.publishedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            </View>
            {!update.read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        );
      })}

      {updates.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="newspaper-outline" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyTitle}>Geen updates</Text>
          <Text style={styles.emptyText}>Er zijn momenteel geen nieuwe branche-updates.</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <View style={styles.tabIconContainer}>
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.key ? Palette.blue : SemanticColors.textSecondary}
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
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'recommended' && renderRecommendedTab()}
      {activeTab === 'articles' && renderArticlesTab()}
      {activeTab === 'tutorials' && renderTutorialsTab()}
      {activeTab === 'updates' && renderUpdatesTab()}

      {/* Article Modal */}
      <Modal
        visible={showArticleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowArticleModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowArticleModal(false)}>
              <Ionicons name="close" size={24} color={SemanticColors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => selectedArticle && bookmarkArticle(selectedArticle.id)}
            >
              <Ionicons
                name={selectedArticle?.bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={selectedArticle?.bookmarked ? Palette.blue : SemanticColors.text}
              />
            </TouchableOpacity>
          </View>

          {selectedArticle && (
            <ScrollView style={styles.articleModalContent}>
              <Text style={styles.articleModalCategory}>{selectedArticle.category}</Text>
              <Text style={styles.articleModalTitle}>{selectedArticle.title}</Text>

              <View style={styles.articleModalMeta}>
                <Text style={styles.articleModalAuthor}>Door {selectedArticle.author}</Text>
                <Text style={styles.articleModalDate}>
                  {new Date(selectedArticle.publishedAt).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              <View style={styles.articleModalStats}>
                <View style={styles.articleModalStat}>
                  <Ionicons name="time-outline" size={16} color={SemanticColors.textSecondary} />
                  <Text style={styles.articleModalStatText}>{selectedArticle.readTime} min leestijd</Text>
                </View>
                <View style={styles.articleModalStat}>
                  <Ionicons name="eye-outline" size={16} color={SemanticColors.textSecondary} />
                  <Text style={styles.articleModalStatText}>{selectedArticle.views} views</Text>
                </View>
                <View style={styles.articleModalStat}>
                  <Ionicons name="thumbs-up-outline" size={16} color={SemanticColors.textSecondary} />
                  <Text style={styles.articleModalStatText}>{selectedArticle.helpful} nuttig</Text>
                </View>
              </View>

              <View style={styles.articleModalTags}>
                {selectedArticle.tags.map((tag, index) => (
                  <View key={index} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.articleModalSummary}>{selectedArticle.summary}</Text>
              <Text style={styles.articleModalBody}>{selectedArticle.content}</Text>

              <View style={styles.articleActions}>
                <TouchableOpacity style={styles.helpfulButton}>
                  <Ionicons name="thumbs-up-outline" size={20} color={Palette.blue} />
                  <Text style={styles.helpfulButtonText}>Nuttig</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareButton}>
                  <Ionicons name="share-outline" size={20} color={SemanticColors.text} />
                  <Text style={styles.shareButtonText}>Delen</Text>
                </TouchableOpacity>
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
    backgroundColor: SemanticColors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
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
    backgroundColor: Palette.blue + '15',
  },
  tabIconContainer: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Palette.red,
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
    color: Palette.blue,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  seeAllText: {
    fontSize: 14,
    color: Palette.blue,
  },

  // Skills
  skillsScroll: {
    marginBottom: 16,
  },
  skillCard: {
    width: 180,
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  skillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  skillName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  skillLevel: {
    fontSize: 12,
    fontWeight: '600',
  },
  skillBar: {
    height: 6,
    backgroundColor: SemanticColors.border,
    borderRadius: 3,
    marginBottom: 8,
  },
  skillFill: {
    height: '100%',
    borderRadius: 3,
  },
  skillBasis: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },

  // Learning Paths
  pathCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  pathHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  pathIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.purple + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathInfo: {
    flex: 1,
  },
  pathTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  pathDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  pathProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  pathProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: SemanticColors.border,
    borderRadius: 3,
  },
  pathProgressFill: {
    height: '100%',
    backgroundColor: Palette.purple,
    borderRadius: 3,
  },
  pathProgressText: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.purple,
  },
  pathMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  pathMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pathMetaText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Articles
  articleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  articleContent: {
    flex: 1,
  },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  articleCategory: {
    fontSize: 11,
    color: Palette.blue,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  articleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 4,
  },
  articleSummary: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  articleMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  articleMetaText: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 15,
    color: SemanticColors.text,
  },

  // Categories
  categoriesScroll: {
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: SemanticColors.card,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 13,
    color: SemanticColors.text,
  },

  // Tutorials
  tutorialCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  tutorialHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  tutorialIcon: {
    position: 'relative',
  },
  tutorialProgressRing: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Palette.blue,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  tutorialProgressText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  tutorialCompleteIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  tutorialInfo: {
    flex: 1,
  },
  tutorialTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  tutorialDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  tutorialMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  tutorialMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tutorialMetaText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  tutorialProgressBar: {
    height: 4,
    backgroundColor: SemanticColors.border,
    borderRadius: 2,
    marginBottom: 12,
  },
  tutorialProgressFill: {
    height: '100%',
    backgroundColor: Palette.blue,
    borderRadius: 2,
  },
  skillsGained: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
    paddingTop: 12,
  },
  skillsGainedLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginBottom: 6,
  },
  skillsGainedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillGainedChip: {
    backgroundColor: Palette.emerald + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  skillGainedText: {
    fontSize: 12,
    color: Palette.emerald,
    fontWeight: '500',
  },

  // Updates
  updateCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    gap: 12,
  },
  updateCardUnread: {
    backgroundColor: Palette.blue + '08',
    borderColor: Palette.blue + '30',
  },
  updateIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateContent: {
    flex: 1,
  },
  updateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  updateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
    flex: 1,
  },
  importanceBadge: {},
  updateSummary: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  updateMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  updateSource: {
    fontSize: 11,
    color: Palette.blue,
    fontWeight: '500',
  },
  updateDate: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.blue,
    marginTop: 6,
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
    color: SemanticColors.text,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
    backgroundColor: SemanticColors.card,
  },
  articleModalContent: {
    flex: 1,
    padding: 16,
  },
  articleModalCategory: {
    fontSize: 12,
    color: Palette.blue,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  articleModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.text,
    lineHeight: 30,
    marginBottom: 12,
  },
  articleModalMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  articleModalAuthor: {
    fontSize: 14,
    color: SemanticColors.text,
  },
  articleModalDate: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  articleModalStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  articleModalStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  articleModalStatText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  articleModalTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  tagChip: {
    backgroundColor: SemanticColors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  tagText: {
    fontSize: 12,
    color: SemanticColors.text,
  },
  articleModalSummary: {
    fontSize: 16,
    color: SemanticColors.text,
    fontWeight: '500',
    lineHeight: 24,
    marginBottom: 20,
  },
  articleModalBody: {
    fontSize: 15,
    color: SemanticColors.text,
    lineHeight: 24,
    marginBottom: 24,
  },
  articleActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  helpfulButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Palette.blue,
    gap: 8,
  },
  helpfulButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.blue,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: SemanticColors.card,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
});
