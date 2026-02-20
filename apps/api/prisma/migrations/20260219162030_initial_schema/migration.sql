-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('instructor', 'student', 'ta', 'admin');

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('svg', 'three_js', 'photographic');

-- CreateEnum
CREATE TYPE "LabType" AS ENUM ('identification', 'dissection', 'quiz', 'practical');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('not_started', 'in_progress', 'submitted', 'graded');

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canvas_url" TEXT NOT NULL,
    "lti_client_id" TEXT NOT NULL,
    "lti_deployment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "canvas_user_id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "canvas_course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "term" TEXT,
    "instructor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animals" (
    "id" TEXT NOT NULL,
    "common_name" TEXT NOT NULL,
    "scientific_name" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "model_type" "ModelType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dissection_models" (
    "id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "organ_system" TEXT NOT NULL,
    "model_file_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "layer_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dissection_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anatomical_structures" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latin_name" TEXT,
    "svg_element_id" TEXT,
    "description" TEXT,
    "fun_fact" TEXT,
    "hint" TEXT,
    "difficulty_level" TEXT NOT NULL DEFAULT 'medium',
    "coordinates" JSONB,
    "tags" TEXT[],

    CONSTRAINT "anatomical_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labs" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "canvas_assignment_id" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "animal_id" TEXT NOT NULL,
    "organ_systems" TEXT[],
    "lab_type" "LabType" NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "rubric" JSONB NOT NULL DEFAULT '{}',
    "due_date" TIMESTAMP(3),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "max_points" DECIMAL(65,30) NOT NULL DEFAULT 100,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_structures" (
    "id" TEXT NOT NULL,
    "lab_id" TEXT NOT NULL,
    "structure_id" TEXT NOT NULL,
    "points_possible" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER,

    CONSTRAINT "lab_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_attempts" (
    "id" TEXT NOT NULL,
    "lab_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "status" "AttemptStatus" NOT NULL DEFAULT 'not_started',
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "graded_at" TIMESTAMP(3),
    "time_spent_seconds" INTEGER,
    "score" DECIMAL(65,30),
    "percentage" DECIMAL(65,30),
    "instructor_feedback" TEXT,
    "canvas_submission_id" TEXT,
    "lti_outcome_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structure_responses" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "structure_id" TEXT NOT NULL,
    "student_answer" TEXT,
    "is_correct" BOOLEAN,
    "confidence_level" INTEGER,
    "hints_used" INTEGER NOT NULL DEFAULT 0,
    "time_spent_seconds" INTEGER,
    "points_earned" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "auto_graded" BOOLEAN NOT NULL DEFAULT true,
    "instructor_override" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "structure_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dissection_events" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "structure_id" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dissection_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_sync_log" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "canvas_status" TEXT,
    "canvas_response" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institutions_canvas_url_key" ON "institutions"("canvas_url");

-- CreateIndex
CREATE UNIQUE INDEX "users_institution_id_canvas_user_id_key" ON "users"("institution_id", "canvas_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_institution_id_canvas_course_id_key" ON "courses"("institution_id", "canvas_course_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dissection_models" ADD CONSTRAINT "dissection_models_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anatomical_structures" ADD CONSTRAINT "anatomical_structures_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "dissection_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labs" ADD CONSTRAINT "labs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labs" ADD CONSTRAINT "labs_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_structures" ADD CONSTRAINT "lab_structures_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_structures" ADD CONSTRAINT "lab_structures_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "anatomical_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_attempts" ADD CONSTRAINT "lab_attempts_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_attempts" ADD CONSTRAINT "lab_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structure_responses" ADD CONSTRAINT "structure_responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "lab_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structure_responses" ADD CONSTRAINT "structure_responses_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "anatomical_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dissection_events" ADD CONSTRAINT "dissection_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "lab_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dissection_events" ADD CONSTRAINT "dissection_events_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "anatomical_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_sync_log" ADD CONSTRAINT "grade_sync_log_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "lab_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
