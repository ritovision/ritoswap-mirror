// dapp/components/errors/InlineErrorBoundary.tsx
"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";
import { publicConfig } from "@config/public.env";
import ErrorShellInline from "./ErrorShellInline";

type Props = {
  children: React.ReactNode;
  title?: string;
  message?: string;
  component?: string;
  showErrorDetails?: boolean;
  onReset?: () => void;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export default class InlineErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.withScope((scope) => {
      if (this.props.component) {
        scope.setTag("component", this.props.component);
      }
      scope.setContext("react", { componentStack: info.componentStack });
      Sentry.captureException(error);
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const showDetails = this.props.showErrorDetails ?? publicConfig.isDevelopment;
    const fallbackMessage =
      this.props.message ??
      (showDetails && this.state.error?.message
        ? `Dev error: ${this.state.error.message}`
        : "Please try again.");

    return (
      <ErrorShellInline
        title={this.props.title ?? "Something went wrong"}
        message={fallbackMessage}
        onRetry={this.handleRetry}
      />
    );
  }
}
