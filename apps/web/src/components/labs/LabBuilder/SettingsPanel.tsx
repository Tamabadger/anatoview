import {
  Box,
  Typography,
  TextField,
  Slider,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Divider,
  Alert,
} from '@mui/material';
import { useFormContext, Controller } from 'react-hook-form';
import type { LabBuilderFormData } from './types';

/**
 * Step 5: Settings Panel
 * Lab metadata and configuration: title, instructions, time limit, attempts,
 * show hints, randomize order, passing threshold, lab type, due date.
 */
export default function SettingsPanel() {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<LabBuilderFormData>();

  const timeLimitMinutes = watch('timeLimitMinutes');
  const attemptsAllowed = watch('attemptsAllowed');
  const passingThresholdPercent = watch('passingThresholdPercent');

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Step 5: Lab Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure timing, attempts, and other lab options.
      </Typography>

      {/* ─── Basic Info ──────────────────────────────────────── */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Lab Title"
            placeholder="e.g., Cat Cardiovascular Lab — Midterm Practical"
            variant="outlined"
            {...register('title')}
            error={!!errors.title}
            helperText={errors.title?.message}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Instructions"
            placeholder="Instructions shown to students before they begin..."
            multiline
            rows={3}
            variant="outlined"
            {...register('instructions')}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="labType"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Lab Type</InputLabel>
                <Select {...field} label="Lab Type">
                  <MenuItem value="identification">Identification</MenuItem>
                  <MenuItem value="dissection">Dissection</MenuItem>
                  <MenuItem value="quiz">Quiz</MenuItem>
                  <MenuItem value="practical">Practical</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Due Date"
            type="datetime-local"
            InputLabelProps={{ shrink: true }}
            variant="outlined"
            {...register('dueDate')}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* ─── Time Limit ──────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Time Limit
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Set to 0 for unlimited time. Students will see a countdown timer during the lab.
        </Typography>

        <Controller
          name="timeLimitMinutes"
          control={control}
          render={({ field }) => (
            <Box sx={{ px: 1 }}>
              <Slider
                value={field.value ?? 0}
                onChange={(_, val) => field.onChange(val === 0 ? null : val)}
                min={0}
                max={180}
                step={5}
                marks={[
                  { value: 0, label: 'No limit' },
                  { value: 30, label: '30m' },
                  { value: 60, label: '1hr' },
                  { value: 120, label: '2hr' },
                  { value: 180, label: '3hr' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => (v === 0 ? 'Unlimited' : `${v} min`)}
              />
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {timeLimitMinutes
                  ? `${timeLimitMinutes} minutes`
                  : 'No time limit'}
              </Typography>
            </Box>
          )}
        />
      </Box>

      {/* ─── Attempts Allowed ────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Attempts Allowed
        </Typography>

        <Controller
          name="attemptsAllowed"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small" sx={{ maxWidth: 200 }}>
              <Select
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
              >
                {[1, 2, 3, 5, 10, 100].map((n) => (
                  <MenuItem key={n} value={n}>
                    {n === 100 ? 'Unlimited' : `${n} attempt${n > 1 ? 's' : ''}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Currently: {attemptsAllowed === 100 ? 'Unlimited' : attemptsAllowed} attempt
          {attemptsAllowed > 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* ─── Passing Threshold ───────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Passing Threshold: {passingThresholdPercent}%
        </Typography>

        <Controller
          name="passingThresholdPercent"
          control={control}
          render={({ field }) => (
            <Slider
              value={field.value}
              onChange={(_, val) => field.onChange(val)}
              min={0}
              max={100}
              step={5}
              marks={[
                { value: 0, label: '0%' },
                { value: 50, label: '50%' },
                { value: 60, label: '60%' },
                { value: 70, label: '70%' },
                { value: 80, label: '80%' },
                { value: 100, label: '100%' },
              ]}
              valueLabelDisplay="auto"
              sx={{ maxWidth: 500 }}
            />
          )}
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* ─── Toggle Switches ─────────────────────────────────── */}
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        Options
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Controller
          name="showHints"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value}
                  onChange={(_, checked) => field.onChange(checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    Show Hints
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Allow students to request hints (with score penalty)
                  </Typography>
                </Box>
              }
            />
          )}
        />

        <Controller
          name="randomizeOrder"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value}
                  onChange={(_, checked) => field.onChange(checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    Randomize Structure Order
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Randomize which structures are highlighted for each student
                  </Typography>
                </Box>
              }
            />
          )}
        />
      </Box>

      {errors.title && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errors.title.message}
        </Alert>
      )}
    </Box>
  );
}
