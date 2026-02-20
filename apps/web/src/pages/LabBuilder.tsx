import { LabBuilderStepper } from '@/components/labs/LabBuilder';

/**
 * Lab Builder page — renders the multi-step lab creation wizard.
 * Route: /labs/new or /labs/:id/edit
 */
export default function LabBuilder() {
  return <LabBuilderStepper />;
}
