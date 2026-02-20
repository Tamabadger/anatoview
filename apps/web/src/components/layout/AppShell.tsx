import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Avatar,
  Chip,
  Tooltip,
  useMediaQuery,
  useTheme,
  alpha,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ScienceIcon from '@mui/icons-material/Science';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import GradingIcon from '@mui/icons-material/Grading';
import InsightsIcon from '@mui/icons-material/Insights';
import PetsIcon from '@mui/icons-material/Pets';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useAppStore } from '@/stores/useAppStore';
import apiClient, { clearTokens } from '@/api/client';
import ErrorBoundary from '@/components/shared/ErrorBoundary';

const DRAWER_WIDTH = 270;

/**
 * Main application shell with responsive AppBar + Drawer sidebar.
 * Modern design with gradient branding, refined nav states, and glass-effect AppBar.
 */
export default function AppShell() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppStore((state) => state.user);
  const themeMode = useAppStore((state) => state.themeMode);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const isDark = themeMode === 'dark';

  const isStaff = user && ['instructor', 'ta', 'admin'].includes(user.role);

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore errors — clear tokens regardless
    }
    clearTokens();
    useAppStore.getState().reset();
    navigate('/unauthorized');
  };

  const navItems = [
    {
      label: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      show: true,
    },
    {
      label: 'Create Lab',
      icon: <AddCircleIcon />,
      path: '/labs/new',
      show: isStaff,
    },
    {
      label: 'Grade Center',
      icon: <GradingIcon />,
      path: '/grade-center',
      show: isStaff,
    },
    {
      label: 'Analytics',
      icon: <InsightsIcon />,
      path: '/analytics',
      show: isStaff,
    },
    {
      label: 'Specimen Library',
      icon: <PetsIcon />,
      path: '/animals',
      show: true,
    },
    {
      label: 'Manage Specimens',
      icon: <SettingsIcon />,
      path: '/animals/manage',
      show: !!isStaff,
    },
  ];

  const roleColors: Record<string, 'primary' | 'secondary' | 'warning' | 'info'> = {
    admin: 'warning',
    instructor: 'primary',
    ta: 'info',
    student: 'secondary',
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ─── Gradient Brand ───────────────────────────────── */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.5,
            background: 'linear-gradient(135deg, #1B4F72 0%, #2ECC71 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(27, 79, 114, 0.3)',
            flexShrink: 0,
          }}
        >
          <ScienceIcon sx={{ color: '#fff', fontSize: 24 }} />
        </Box>
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              lineHeight: 1.2,
              background: 'linear-gradient(135deg, #1B4F72 0%, #2ECC71 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            AnatoView
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.04em' }}>
            Anatomy Lab Platform
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mx: 2 }} />

      {/* ─── Navigation Links ─────────────────────────────── */}
      <List sx={{ flex: 1, px: 1.5, py: 1.5 }}>
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <ListItemButton
                key={item.path}
                selected={isActive}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setDrawerOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  px: 1.5,
                  py: 1,
                  position: 'relative',
                  '&.Mui-selected': {
                    backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08),
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '20%',
                      bottom: '20%',
                      width: 3,
                      borderRadius: '0 4px 4px 0',
                      backgroundColor: 'primary.main',
                    },
                  },
                  '&:hover': {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 38 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: isActive ? 700 : 500,
                  }}
                />
              </ListItemButton>
            );
          })}
      </List>

      <Divider sx={{ mx: 2 }} />

      {/* ─── Theme Toggle + Sign Out Row ──────────────────── */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1 }}>
        <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'} arrow>
          <IconButton
            onClick={toggleTheme}
            size="small"
            sx={{
              borderRadius: 2,
              width: 38,
              height: 38,
              backgroundColor: isDark
                ? alpha(theme.palette.warning.main, 0.1)
                : alpha(theme.palette.primary.main, 0.06),
              '&:hover': {
                backgroundColor: isDark
                  ? alpha(theme.palette.warning.main, 0.2)
                  : alpha(theme.palette.primary.main, 0.12),
              },
            }}
          >
            {isDark ? (
              <LightModeIcon fontSize="small" sx={{ color: 'warning.main' }} />
            ) : (
              <DarkModeIcon fontSize="small" sx={{ color: 'primary.main' }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Sign Out" arrow>
          <IconButton
            onClick={handleLogout}
            size="small"
            sx={{
              borderRadius: 2,
              width: 38,
              height: 38,
              '&:hover': {
                backgroundColor: alpha(theme.palette.error.main, 0.08),
                color: 'error.main',
              },
            }}
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ─── User Card ────────────────────────────────────── */}
      {user && (
        <Box
          sx={{
            mx: 1.5,
            mb: 1.5,
            p: 1.5,
            borderRadius: 2.5,
            backgroundColor: isDark
              ? alpha(theme.palette.primary.main, 0.06)
              : alpha(theme.palette.primary.main, 0.03),
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                fontSize: '0.875rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #1B4F72 0%, #2ECC71 100%)',
                boxShadow: '0 2px 8px rgba(27, 79, 114, 0.25)',
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap sx={{ lineHeight: 1.3 }}>
                {user.name}
              </Typography>
              <Chip
                label={user.role}
                size="small"
                color={roleColors[user.role] || 'default'}
                sx={{
                  height: 20,
                  fontSize: '0.675rem',
                  fontWeight: 700,
                  textTransform: 'capitalize',
                  letterSpacing: '0.03em',
                }}
              />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar Drawer */}
      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Top AppBar */}
        <AppBar position="sticky" color="inherit">
          <Toolbar>
            <IconButton
              edge="start"
              onClick={() => setDrawerOpen(!drawerOpen)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h6"
              component="div"
              sx={{
                flexGrow: 1,
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
              color="text.primary"
            >
              {getPageTitle(location.pathname)}
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box
          sx={{
            flex: 1,
            p: { xs: 2, sm: 3 },
            backgroundColor: 'background.default',
          }}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </Box>
      </Box>
    </Box>
  );
}

function getPageTitle(path: string): string {
  if (path === '/dashboard') return 'Dashboard';
  if (path === '/labs/new') return 'Create New Lab';
  if (path.startsWith('/labs/') && path.endsWith('/edit')) return 'Edit Lab';
  if (path.startsWith('/labs/') && path.endsWith('/results')) return 'Class Results';
  if (path === '/grade-center') return 'Grade Center';
  if (path === '/analytics') return 'Lab Analytics';
  if (path === '/animals/manage') return 'Manage Specimens';
  if (path === '/animals') return 'Specimen Library';
  if (path.startsWith('/lab/')) return 'Lab Session';
  return 'AnatoView';
}
