import { Card, Text } from '@ankhorage/zora';
import React from 'react';

interface ModuleAdminViewBoundaryProps {
  readonly moduleId: string;
  readonly children: React.ReactNode;
}

interface ModuleAdminViewBoundaryState {
  readonly error: string | null;
}

/***
 * Contain rendering failures from package-owned module administration views so one contribution cannot crash the Studio admin shell.
 * @todo Keep this error boundary at the module-admin UI adapter edge; consume the canonical Utility error-message normalizer instead of duplicating unknown-error conversion.
 */
export class ModuleAdminViewBoundary extends React.Component<
  ModuleAdminViewBoundaryProps,
  ModuleAdminViewBoundaryState
> {
  state: ModuleAdminViewBoundaryState = { error: null };

  /*** Convert a module-view rendering failure into the boundary's displayable error state. */
  static getDerivedStateFromError(error: unknown): ModuleAdminViewBoundaryState {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  /*** Clear a captured contribution error when navigation switches to a different module. */
  componentDidUpdate(previous: ModuleAdminViewBoundaryProps): void {
    if (previous.moduleId !== this.props.moduleId && this.state.error !== null) {
      this.setState({ error: null });
    }
  }

  /*** Render either the package-owned module admin contribution or an isolated error card. */
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
