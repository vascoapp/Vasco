import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import {
  CFODashboard,
  COODashboard,
  SiteLeadDashboard,
  ContractorDashboard,
  DirectorDashboard,
} from '../../src/components/dashboards';
import { useAuth } from '../../src/context/AuthContext';
import { SemanticColors } from '../../src/theme/colors';

export default function HomeScreen() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Screen>
    );
  }

  // Render role-specific dashboard
  const renderDashboard = () => {
    switch (user.role) {
      case 'cfo':
        return <CFODashboard initialTab="overview" showTabBar={false} />;
      case 'coo':
        return <COODashboard initialTab="financials" showTabBar={false} />;
      case 'site-lead':
        return <SiteLeadDashboard initialTab="overview" showTabBar={false} />;
      case 'director':
        return <DirectorDashboard initialTab="portfolio" showTabBar={false} />;
      case 'contractor':
        return <ContractorDashboard />;
      default:
        return <DirectorDashboard initialTab="portfolio" showTabBar={false} />;
    }
  };

  return <Screen>{renderDashboard()}</Screen>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: SemanticColors.textSecondary,
    fontSize: 16,
  },
});
