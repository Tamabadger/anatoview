import React from 'react';
import { Box, Typography, Button, Card, CardContent } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
            p: 3,
          }}
        >
          <Card sx={{ maxWidth: 480, textAlign: 'center' }}>
            <CardContent sx={{ py: 4 }}>
              <ErrorOutlineIcon
                sx={{ fontSize: 64, color: 'error.main', mb: 2 }}
              />
              <Typography variant="h5" fontWeight={600} gutterBottom>
                Something went wrong
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                An unexpected error occurred. Please try reloading the page.
              </Typography>
              {process.env.NODE_ENV !== 'production' && this.state.error && (
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{
                    textAlign: 'left',
                    p: 1.5,
                    mb: 2,
                    backgroundColor: 'grey.100',
                    borderRadius: 1,
                    overflow: 'auto',
                    maxHeight: 120,
                    fontSize: '0.7rem',
                  }}
                >
                  {this.state.error.message}
                </Typography>
              )}
              <Button
                variant="contained"
                onClick={() => window.location.reload()}
                sx={{ mr: 1 }}
              >
                Reload Page
              </Button>
              <Button variant="outlined" onClick={this.handleReset}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}
