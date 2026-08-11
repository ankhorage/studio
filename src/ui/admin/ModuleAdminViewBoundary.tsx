import { Card, Text } from '@ankhorage/zora';
import React from 'react';

interface ModuleAdminViewBoundaryProps {
  readonly moduleId: string;
  readonly children: React.ReactNode;
}

interface ModuleAdminViewBoundaryState {
  readonly error: string | null;
}

export class ModuleAdminViewBoundary extends React.Component<
  ModuleAdminViewBoundaryProps,
  ModuleAdminViewBoundaryState
> {
  state: ModuleAdminViewBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ModuleAdminViewBoundaryState {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidUpdate(previous: ModuleAdminViewBoundaryProps): void {
    if (previous.moduleId !== this.props.moduleId && this.state.error !== null) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <Card title="Administration contribution error">
          <Text color="danger">{this.state.error}</Text>
        </Card>
      );
    }
    return this.props.children;
  }
}
