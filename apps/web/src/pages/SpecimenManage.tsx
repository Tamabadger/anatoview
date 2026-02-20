import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Avatar,
  Skeleton,
  Alert,
  TextField,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PetsIcon from '@mui/icons-material/Pets';
import ScienceIcon from '@mui/icons-material/Science';
import { useAnimals, useUpdateAnimal, type Animal } from '@/api/animals';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type Category,
} from '@/api/categories';
import AnimalFormDialog from '@/components/specimens/AnimalFormDialog';

// ─── Tab Panel ──────────────────────────────────────────────────

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  if (value !== index) return null;
  return <Box sx={{ py: 3 }}>{children}</Box>;
}

// ─── Main Page ──────────────────────────────────────────────────

export default function SpecimenManage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Manage Specimens
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Add, edit, and organize animal specimens and their categories.
      </Typography>

      <Paper sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab icon={<PetsIcon />} iconPosition="start" label="Animals" />
          <Tab icon={<ScienceIcon />} iconPosition="start" label="Categories" />
        </Tabs>
      </Paper>

      <TabPanel value={tab} index={0}>
        <AnimalsTab />
      </TabPanel>
      <TabPanel value={tab} index={1}>
        <CategoriesTab />
      </TabPanel>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════
// Animals Tab
// ═══════════════════════════════════════════════════════════════

function AnimalsTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAnimal, setEditAnimal] = useState<Animal | null>(null);

  const { data, isLoading, error } = useAnimals();
  const updateAnimal = useUpdateAnimal();

  const animals = data?.animals ?? [];

  const handleAdd = () => {
    setEditAnimal(null);
    setDialogOpen(true);
  };

  const handleEdit = (animal: Animal) => {
    setEditAnimal(animal);
    setDialogOpen(true);
  };

  const handleToggleActive = async (animal: Animal) => {
    await updateAnimal.mutateAsync({
      id: animal.id,
      isActive: !animal.isActive,
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">All Specimens</Typography>
        <Button
          variant="contained"
          startIcon={<AddCircleIcon />}
          onClick={handleAdd}
        >
          Add Specimen
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load specimens.
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={60} />
              <TableCell>Name</TableCell>
              <TableCell>Scientific Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="center">Models</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton variant="circular" width={36} height={36} /></TableCell>
                    <TableCell><Skeleton width="60%" /></TableCell>
                    <TableCell><Skeleton width="50%" /></TableCell>
                    <TableCell><Skeleton width={80} /></TableCell>
                    <TableCell><Skeleton width={30} /></TableCell>
                    <TableCell><Skeleton width={60} /></TableCell>
                    <TableCell><Skeleton width={80} /></TableCell>
                  </TableRow>
                ))
              : animals.map((animal) => (
                  <TableRow key={animal.id} sx={{ opacity: animal.isActive ? 1 : 0.5 }}>
                    <TableCell>
                      {animal.thumbnailUrl ? (
                        <Avatar
                          src={animal.thumbnailUrl}
                          variant="rounded"
                          sx={{ width: 36, height: 36 }}
                        />
                      ) : (
                        <Avatar variant="rounded" sx={{ width: 36, height: 36, bgcolor: 'grey.100' }}>
                          <PetsIcon fontSize="small" color="action" />
                        </Avatar>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {animal.commonName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }} color="text.secondary">
                        {animal.scientificName || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={animal.category?.name ?? 'Unknown'}
                        size="small"
                        sx={{
                          backgroundColor: `${animal.category?.color ?? '#95A5A6'}20`,
                          color: animal.category?.color ?? '#95A5A6',
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {animal.models?.length ?? 0}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={animal.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={animal.isActive ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(animal)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={animal.isActive ? 'Deactivate' : 'Activate'}>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleActive(animal)}
                          disabled={updateAnimal.isPending}
                        >
                          {animal.isActive ? (
                            <VisibilityOffIcon fontSize="small" />
                          ) : (
                            <VisibilityIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && animals.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No specimens yet. Add one to get started.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <AnimalFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        animal={editAnimal}
      />
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════
// Categories Tab
// ═══════════════════════════════════════════════════════════════

function CategoriesTab() {
  const [addOpen, setAddOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);

  const { data, isLoading, error } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const categories = data ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Categories</Typography>
        <Button
          variant="contained"
          startIcon={<AddCircleIcon />}
          onClick={() => setAddOpen(true)}
        >
          Add Category
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load categories.
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={50}>Color</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Icon</TableCell>
              <TableCell align="center">Sort Order</TableCell>
              <TableCell align="center">Animals</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton variant="circular" width={24} height={24} /></TableCell>
                    <TableCell><Skeleton width="50%" /></TableCell>
                    <TableCell><Skeleton width={60} /></TableCell>
                    <TableCell><Skeleton width={30} /></TableCell>
                    <TableCell><Skeleton width={30} /></TableCell>
                    <TableCell><Skeleton width={60} /></TableCell>
                  </TableRow>
                ))
              : categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: cat.color,
                          border: '2px solid',
                          borderColor: 'divider',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {cat.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {cat.icon || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{cat.sortOrder}</TableCell>
                    <TableCell align="center">{cat._count?.animals ?? 0}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setEditCat(cat)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={async () => {
                            if ((cat._count?.animals ?? 0) > 0) {
                              alert('Cannot delete a category that has animals. Reassign animals first.');
                              return;
                            }
                            await deleteCategory.mutateAsync(cat.id);
                          }}
                          disabled={deleteCategory.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No categories yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add / Edit Category Dialog */}
      <CategoryFormDialog
        open={addOpen || !!editCat}
        onClose={() => {
          setAddOpen(false);
          setEditCat(null);
        }}
        category={editCat}
        onCreate={async (data) => {
          await createCategory.mutateAsync(data);
          setAddOpen(false);
        }}
        onUpdate={async (data) => {
          if (editCat) {
            await updateCategory.mutateAsync({ id: editCat.id, ...data });
            setEditCat(null);
          }
        }}
        isBusy={createCategory.isPending || updateCategory.isPending}
      />
    </Box>
  );
}

// ─── Category Form Dialog ───────────────────────────────────────

interface CategoryFormDialogProps {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  onCreate: (data: { name: string; color: string; icon?: string; sortOrder?: number }) => Promise<void>;
  onUpdate: (data: { name?: string; color?: string; icon?: string; sortOrder?: number }) => Promise<void>;
  isBusy: boolean;
}

function CategoryFormDialog({ open, onClose, category, onCreate, onUpdate, isBusy }: CategoryFormDialogProps) {
  const isEdit = !!category;
  const [name, setName] = useState('');
  const [color, setColor] = useState('#1B4F72');
  const [icon, setIcon] = useState('');
  const [sortOrder, setSortOrder] = useState(0);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name);
        setColor(category.color);
        setIcon(category.icon || '');
        setSortOrder(category.sortOrder);
      } else {
        setName('');
        setColor('#1B4F72');
        setIcon('');
        setSortOrder(0);
      }
    }
  }, [open, category]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      if (isEdit) {
        await onUpdate({
          name: name.trim(),
          color,
          icon: icon.trim() || undefined,
          sortOrder,
        });
      } else {
        await onCreate({
          name: name.trim(),
          color,
          icon: icon.trim() || undefined,
          sortOrder,
        });
      }
    } catch {
      // handled by mutation
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Category' : 'Add Category'}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <TextField
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label="Color (hex)"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              sx={{ flex: 1 }}
            />
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                backgroundColor: color,
                border: '2px solid',
                borderColor: 'divider',
                flexShrink: 0,
              }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: 40,
                height: 40,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          </Box>
          <TextField
            label="MUI Icon Name"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            helperText="e.g. Pets, Water, BugReport, Straighten"
            fullWidth
          />
          <TextField
            label="Sort Order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isBusy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isBusy || !name.trim()}>
          {isBusy ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
