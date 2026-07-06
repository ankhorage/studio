import { Icon, Text } from '@ankhorage/zora';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { ProjectItem } from '../types';

export function ProjectCard(props: {
  project: ProjectItem;
  borderColor: string;
  isSyncing: boolean;
  isLaunching: boolean;
  isInstallingPackages: boolean;
  isReloadingInfra: boolean;
  onLaunch: () => void;
  onSync: () => void;
  onInstallPackages: () => void;
  onReloadInfra: () => void;
  onDelete: () => void;
}) {
  const {
    project,
    borderColor,
    isSyncing,
    isLaunching,
    isInstallingPackages,
    isReloadingInfra,
    onLaunch,
    onSync,
    onInstallPackages,
    onReloadInfra,
    onDelete,
  } = props;

  return (
    <View
      style={{
        width: 250,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor,
        borderRadius: 12,
      }}
    >
      <View style={styles.cardBody}>
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: '#2563eb',
            },
          ]}
        >
          <Icon name="cube-outline" size={32} color="#fff" />
        </View>
        <View style={styles.projectMeta}>
          <Text align="center" numberOfLines={1} variant="bodySmall" weight="semiBold">
            {project.name}
          </Text>
          <Text color="neutral" emphasis="muted" variant="caption">
            v{project.version}
          </Text>
        </View>
      </View>

      <View style={[styles.actionsRow, { borderTopWidth: 1, borderTopColor: borderColor }]}>
        <ActionButton
          label="Run"
          iconName="play-outline"
          loading={isLaunching}
          onPress={onLaunch}
          accessibilityLabel="Launch project app"
          borderColor={borderColor}
        />
        <ActionButton
          label="Sync"
          iconName="refresh-outline"
          loading={isSyncing}
          onPress={onSync}
          accessibilityLabel="Synchronize project"
          borderColor={borderColor}
        />
        <ActionButton
          label="Install Packages"
          iconName="download-outline"
          loading={isInstallingPackages}
          onPress={onInstallPackages}
          accessibilityLabel="Install workspace packages"
          borderColor={borderColor}
        />
        <ActionButton
          label="Init/Reload Infra"
          iconName="cloud-upload-outline"
          loading={isReloadingInfra}
          onPress={onReloadInfra}
          accessibilityLabel="Initialize or reload project infrastructure"
          borderColor={borderColor}
        />
        <ActionButton
          label="Delete Project"
          iconName="trash-outline"
          loading={false}
          onPress={onDelete}
          accessibilityLabel="Delete project"
          borderColor={borderColor}
          destructive
        />
      </View>
    </View>
  );
}

function ActionButton(props: {
  label: string;
  iconName: string;
  loading: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  borderColor: string;
  destructive?: boolean;
}) {
  const {
    label,
    iconName,
    loading,
    onPress,
    accessibilityLabel,
    borderColor,
    destructive = false,
  } = props;
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <Pressable
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        borderWidth: 1,
        borderColor,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
      onPress={onPress}
      disabled={loading}
      accessibilityLabel={accessibilityLabel}
      onHoverIn={() => setShowTooltip(true)}
      onHoverOut={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      {showTooltip ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: '100%',
            marginBottom: 6,
            left: '50%',
            transform: [{ translateX: -44 }],
            backgroundColor: 'rgba(17,17,17,0.92)',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            maxWidth: 140,
          }}
        >
          <Text numberOfLines={1} color="neutral" emphasis="inverse" variant="caption">
            {label}
          </Text>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <Icon name={iconName} size={14} color={destructive ? 'error' : 'primary'} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 130,
  },
  projectMeta: {
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
