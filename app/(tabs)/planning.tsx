/**
 * Contractor Planning Screen
 *
 * Provides predictive capacity planning features:
 * - See availability at a glance
 * - Get accurate job duration estimates
 * - Identify potential delays
 * - Generate customer-ready responses
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CapacityPlanning } from '../../src/components/contractor/CapacityPlanning';

export default function PlanningScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CapacityPlanning />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
