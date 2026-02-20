import { useState, useCallback } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Card,
  CardContent,
  Typography,
} from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import CategoryIcon from '@mui/icons-material/Category';
import ChecklistIcon from '@mui/icons-material/Checklist';
import TuneIcon from '@mui/icons-material/Tune';
import SettingsIcon from '@mui/icons-material/Settings';
import PreviewIcon from '@mui/icons-material/Preview';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AnimalSelector from './AnimalSelector';
import SystemSelector from './SystemSelector';
import StructurePicker from './StructurePicker';
import RubricBuilder from './RubricBuilder';
import SettingsPanel from './SettingsPanel';
import ReviewAndPublish from './ReviewAndPublish';
import {
  type LabBuilderFormData,
  defaultFormData,
  animalStepSchema,
  systemStepSchema,
  structureStepSchema,
  settingsStepSchema,
  LAB_BUILDER_STEPS,
} from './types';

// ─── Combined schema (loosely validated — each step validates its own part) ──
const fullSchema = z.object({
  animalId: z.string(),
  organSystems: z.array(z.string()),
  structureIds: z.array(z.string()),
  structureConfigs: z.record(z.string(), z.any()),
  structureRubrics: z.record(z.string(), z.any()),
  categoryWeights: z.record(z.string(), z.number()).default({}),
  title: z.string(),
  instructions: z.string().default(''),
  labType: z.enum(['identification', 'dissection', 'quiz', 'practical']),
  timeLimitMinutes: z.number().nullable().default(null),
  attemptsAllowed: z.number().default(1),
  showHints: z.boolean().default(true),
  randomizeOrder: z.boolean().default(false),
  passingThresholdPercent: z.number().default(60),
  dueDate: z.string().default(''),
});

/** Per-step validation schemas */
const STEP_SCHEMAS = [
  animalStepSchema,
  systemStepSchema,
  structureStepSchema,
  null, // Rubric step — no strict validation (all optional)
  settingsStepSchema,
  null, // Review step — no validation
];

const STEP_ICONS = [
  <PetsIcon key="pets" />,
  <CategoryIcon key="cat" />,
  <ChecklistIcon key="check" />,
  <TuneIcon key="tune" />,
  <SettingsIcon key="settings" />,
  <PreviewIcon key="preview" />,
];

/**
 * Lab Builder multi-step wizard.
 * Wraps 6 step components in a MUI Stepper with react-hook-form.
 * Each step validates its own fields before allowing navigation forward.
 */
export default function LabBuilderStepper() {
  const [activeStep, setActiveStep] = useState(0);
  const [stepErrors, setStepErrors] = useState<Record<number, boolean>>({});

  const methods = useForm<LabBuilderFormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: defaultFormData,
    mode: 'onChange',
  });

  const { trigger, getValues } = methods;

  /**
   * Validate the current step's fields before moving forward.
   * Returns true if the step is valid.
   */
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const schema = STEP_SCHEMAS[activeStep];
    if (!schema) return true; // Steps without schemas always pass

    try {
      const values = getValues();
      schema.parse(values);
      setStepErrors((prev) => ({ ...prev, [activeStep]: false }));
      return true;
    } catch {
      // Use react-hook-form's trigger to show field-level errors
      const fieldsMap: Record<number, (keyof LabBuilderFormData)[]> = {
        0: ['animalId'],
        1: ['organSystems'],
        2: ['structureIds'],
        4: ['title', 'labType'],
      };

      const fields = fieldsMap[activeStep];
      if (fields) {
        await trigger(fields);
      }

      setStepErrors((prev) => ({ ...prev, [activeStep]: true }));
      return false;
    }
  }, [activeStep, getValues, trigger]);

  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      setActiveStep((prev) => Math.min(prev + 1, LAB_BUILDER_STEPS.length - 1));
    }
  }, [validateCurrentStep]);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleStepClick = useCallback(
    async (stepIndex: number) => {
      // Allow clicking on previous steps freely
      if (stepIndex < activeStep) {
        setActiveStep(stepIndex);
        return;
      }
      // For forward navigation, validate all intermediate steps
      if (stepIndex > activeStep) {
        const isValid = await validateCurrentStep();
        if (isValid) {
          setActiveStep(stepIndex);
        }
      }
    },
    [activeStep, validateCurrentStep]
  );

  return (
    <FormProvider {...methods}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Lab Builder
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Create a new anatomy lab assignment in 6 steps.
        </Typography>

        {/* ─── Stepper ──────────────────────────────────────── */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
          {LAB_BUILDER_STEPS.map((step, index) => (
            <Step
              key={step.key}
              completed={index < activeStep}
              sx={{ cursor: 'pointer' }}
              onClick={() => handleStepClick(index)}
            >
              <StepLabel
                error={!!stepErrors[index]}
                StepIconComponent={() => (
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        stepErrors[index]
                          ? 'error.main'
                          : index <= activeStep
                            ? 'primary.main'
                            : 'grey.300',
                      color: 'white',
                      fontSize: 16,
                    }}
                  >
                    {STEP_ICONS[index]}
                  </Box>
                )}
              >
                {step.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* ─── Step Content ─────────────────────────────────── */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 4 }}>
            {activeStep === 0 && <AnimalSelector />}
            {activeStep === 1 && <SystemSelector />}
            {activeStep === 2 && <StructurePicker />}
            {activeStep === 3 && <RubricBuilder />}
            {activeStep === 4 && <SettingsPanel />}
            {activeStep === 5 && <ReviewAndPublish />}
          </CardContent>
        </Card>

        {/* ─── Navigation Buttons ───────────────────────────── */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={<NavigateBeforeIcon />}
          >
            Previous
          </Button>

          {activeStep < LAB_BUILDER_STEPS.length - 1 && (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<NavigateNextIcon />}
            >
              Next
            </Button>
          )}
        </Box>
      </Box>
    </FormProvider>
  );
}
