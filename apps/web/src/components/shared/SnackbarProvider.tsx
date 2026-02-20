import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Snackbar, Alert, type AlertColor } from '@mui/material';

interface SnackbarContextValue {
  enqueueSnackbar: (message: string, severity?: AlertColor) => void;
}

const SnackbarContext = createContext<SnackbarContextValue>({
  enqueueSnackbar: () => {},
});

export function useSnackbar() {
  return useContext(SnackbarContext);
}

interface QueuedSnack {
  key: number;
  message: string;
  severity: AlertColor;
}

export default function SnackbarProvider({ children }: { children: ReactNode }) {
  const [, setQueue] = useState<QueuedSnack[]>([]);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<QueuedSnack | null>(null);

  const processQueue = useCallback(() => {
    setQueue((prev) => {
      if (prev.length > 0) {
        setCurrent(prev[0]);
        setOpen(true);
        return prev.slice(1);
      }
      return prev;
    });
  }, []);

  const enqueueSnackbar = useCallback(
    (message: string, severity: AlertColor = 'success') => {
      const snack: QueuedSnack = { key: Date.now(), message, severity };

      if (!current) {
        setCurrent(snack);
        setOpen(true);
      } else {
        setQueue((prev) => [...prev, snack]);
      }
    },
    [current]
  );

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const handleExited = () => {
    setCurrent(null);
    processQueue();
  };

  return (
    <SnackbarContext.Provider value={{ enqueueSnackbar }}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={5000}
        onClose={handleClose}
        TransitionProps={{ onExited: handleExited }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {current ? (
          <Alert
            onClose={handleClose}
            severity={current.severity}
            variant="filled"
            sx={{ width: '100%', minWidth: 300 }}
          >
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </SnackbarContext.Provider>
  );
}
