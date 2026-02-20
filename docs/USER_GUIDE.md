# AnatoView User Guide

A complete guide to using AnatoView, the virtual dissection lab platform for pre-veterinary anatomy courses.

---

## Table of Contents

- [Getting Started](#getting-started)
  - [Logging In](#logging-in)
  - [Navigating the Interface](#navigating-the-interface)
  - [Dark Mode](#dark-mode)
- [For Students](#for-students)
  - [Dashboard](#student-dashboard)
  - [Starting a Lab](#starting-a-lab)
  - [The Dissection Lab](#the-dissection-lab)
  - [Answering Questions](#answering-questions)
  - [Using Hints](#using-hints)
  - [Submitting Your Lab](#submitting-your-lab)
  - [Reviewing Your Results](#reviewing-your-results)
  - [Specimen Library](#specimen-library)
- [For Instructors](#for-instructors)
  - [Dashboard](#instructor-dashboard)
  - [Creating a Lab](#creating-a-lab)
  - [Editing a Lab](#editing-a-lab)
  - [Grade Center](#grade-center)
  - [Reviewing Student Attempts](#reviewing-student-attempts)
  - [Grade Overrides](#grade-overrides)
  - [Canvas Grade Sync](#canvas-grade-sync)
  - [Analytics](#analytics)
  - [Managing Specimens](#managing-specimens)
- [The Dissection Viewer](#the-dissection-viewer)
  - [Canvas Controls](#canvas-controls)
  - [Layer Panel](#layer-panel)
  - [Dissection Modes](#dissection-modes)
  - [Structure Search](#structure-search)
- [Available Specimens](#available-specimens)
- [Grading System](#grading-system)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Logging In

AnatoView is designed to integrate with your institution's Canvas LMS. There are two ways to access the application:

**Via Canvas (production):**
Your instructor will add AnatoView assignments to your Canvas course. Click the assignment link in Canvas and you'll be automatically signed in through LTI single sign-on. Your name, email, role, and course are all synchronized from Canvas &mdash; no separate account creation is needed.

**Direct access (development):**
If you're running AnatoView locally for development, the app automatically logs you in as a dev instructor. You can switch to a student role through the browser console (see the [QUICKSTART guide](QUICKSTART.md) for details).

### Navigating the Interface

AnatoView uses a sidebar navigation layout:

- **Sidebar (left):** Contains the main navigation menu, a dark mode toggle, and your user profile card at the bottom. On mobile devices, the sidebar collapses into a hamburger menu.
- **Top bar:** Shows the current page title and a menu button to toggle the sidebar.
- **Main content area:** Displays the active page.

**Navigation items visible to all users:**
- **Dashboard** &mdash; Your home page with stats and lab assignments
- **Specimen Library** &mdash; Browse all available animals and structures

**Additional navigation items for instructors and TAs:**
- **Create Lab** &mdash; Build a new lab assignment (instructors and admins only)
- **Grade Center** &mdash; Review and manage student grades
- **Analytics** &mdash; View class performance data and charts
- **Manage Specimens** &mdash; Add or edit animal specimens (instructors and admins only)

The currently active page is highlighted in the sidebar with a blue tint and a left accent bar.

### Dark Mode

AnatoView supports both light and dark themes. To toggle between them:

1. Look at the bottom of the sidebar, just above your user card.
2. Click the **moon icon** (to switch to dark mode) or the **sun icon** (to switch to light mode).
3. Your preference is saved automatically and persists across sessions.

Dark mode applies a refined dark color palette throughout the entire application, including the dissection viewer, cards, tables, and charts.

---

## For Students

### Student Dashboard

When you log in, you'll land on your Dashboard. It shows:

- **Welcome banner** with your name and a brief description of what you can do.
- **Stats row** with four cards:
  - **Active Labs** &mdash; Number of published labs available to you.
  - **Completed** &mdash; Total number of lab attempts you've made.
  - **Average Score** &mdash; Your overall average (when available).
  - **In Progress** &mdash; Labs you've started but not yet submitted.

- **My Assignments** &mdash; A grid of lab cards. Each card shows:
  - The lab title and published status.
  - The animal specimen (with thumbnail).
  - Organ systems covered (as colored chips).
  - Number of structures to identify.
  - Lab type (e.g., identification, quiz) and maximum points.
  - A **Start Lab** button (or **Continue** if you have a previous attempt).

Click **Start Lab** or **Continue** on any card to open the lab.

### Starting a Lab

Before the dissection begins, you'll see a **Lab Preview page** with:

- **Lab header** showing the title, animal, organ systems, and point value.
- **Instructions** from your instructor explaining what to do.
- **Structures to Identify** &mdash; a numbered list of every structure you'll need to find. Each shows:
  - The structure name and Latin name.
  - A difficulty indicator: green (easy), amber (medium), or red (hard).
  - An optional description.

- **Sidebar information:**
  - **Time limit** (if set by your instructor) &mdash; a countdown begins when you click Start.
  - **Lab details** including animal, structure count, max points, hint penalty, and due date.
  - The large **Start Lab** button.

> **Important:** If your instructor set a time limit, your timer begins the moment you click Start. If there is no time limit, you can save your progress and return later.

Click **Start Lab** to enter the dissection viewer.

### The Dissection Lab

The dissection lab is a full-screen interactive workspace. Here's what you'll see:

**Top bar (left to right):**
- **Timer** &mdash; Shows elapsed time in MM:SS format.
- **Progress bar** &mdash; Shows how many structures you've answered out of the total (e.g., "3/20 structures, 15%").
- **Score indicator** &mdash; Shows how many you've gotten correct so far (e.g., "2/3 correct").
- **Hints counter** &mdash; Shows total hints used across all structures.
- **Submit button** &mdash; Submit your lab when you're done.

**Main canvas area (center/left):**
- The interactive SVG dissection model. You can zoom, pan, and click on structures.
- A toolbar at the bottom for zoom controls and mode switching.
- A zoom percentage indicator in the bottom-right corner.

**Right sidebar:**
- **Structure Search** &mdash; Find structures by name.
- **Layer Panel** &mdash; Toggle organ system visibility.
- **Answer Input** &mdash; Type your answer when a structure is selected (in Identify or Quiz mode).
- **Answered Structures** &mdash; A summary of all structures you've answered, color-coded green (correct) or gray (incorrect).

### Answering Questions

To identify a structure:

1. **Click on a highlighted structure** in the dissection viewer. It will be outlined in blue.
2. The **Answer Input** panel appears in the right sidebar showing the prompt "Type structure name..."
3. **Type your answer** in the text field. Spelling doesn't need to be perfect &mdash; the system accepts answers within 2 character edits (Levenshtein distance) of the correct name.
4. Press **Enter** or click the **Check** button.
5. You'll see immediate feedback:
   - **Correct:** A green success message showing the structure name. The structure turns green on the canvas.
   - **Incorrect:** A red error message showing what you typed. The structure turns red on the canvas.
6. Click another structure to continue.

**What counts as a correct answer:**
- The exact structure name (case-insensitive, ignoring punctuation).
- The Latin/scientific name.
- Any accepted aliases your instructor added (e.g., abbreviations, common alternate names).
- Close misspellings within 2 character edits (e.g., "aorta" matches "aortic" is too far, but "aorta" matches "aorta" exactly, and "aort" matches with 1 edit).

### Using Hints

If your instructor enabled hints, you can request them for additional help:

1. Select a structure and look at the Answer Input panel.
2. Click the **Hint** button (lightbulb icon, amber/yellow color).
3. A **Hint Drawer** slides in from the right showing the hint text for that structure.
4. Each hint used **reduces your score** for that structure by the penalty amount (typically 10%).
5. The hints counter in the top bar tracks your total hints used.

> **Note:** Not all structures have hints. The Hint button only appears when a hint is available. Your instructor sets the hint penalty percentage when creating the lab.

In **Explore mode**, you can also access hints through the structure popover by clicking "Show Hint (−10% penalty)."

### Submitting Your Lab

When you've answered all the structures (or as many as you'd like):

1. Click the **Submit** button in the top bar (paper plane icon).
2. Your answers are saved and graded automatically.
3. You're redirected to the **Results page**.

> **Tip:** You don't have to answer every structure before submitting. Unanswered structures will receive zero points. If your instructor allows multiple attempts, you can try again later.

### Reviewing Your Results

After submitting, you'll see the **Results page** with a detailed breakdown:

**Score Card (top):**
- A color-coded banner: green (85%+), amber (70-85%), or red (below 70%).
- Your **percentage score** prominently displayed.
- **Raw score** (e.g., "18.5 of 20 pts").
- **Correct count** (e.g., "17/20 correct").
- **Time spent** on the lab.
- **Instructor feedback** (if your instructor has provided any).

**Structure Breakdown Table:**
A detailed table showing every structure with columns:

| Column | Description |
|--------|-------------|
| Structure | Name and Latin name |
| Your Answer | What you typed (or "No answer") |
| Result | Green checkmark (correct) or red X (incorrect) |
| Hints | Number of hints used for this structure |
| Time | How long you spent on this structure |
| Points | Points earned for this structure |

Rows are color-tinted: light green for correct answers, light red for incorrect.

**Navigation buttons:**
- **Back to Dashboard** &mdash; Return to your assignment list.
- **View Lab** &mdash; Go back to the lab preview page (to attempt again, if allowed).

### Specimen Library

The Specimen Library lets you browse all available animal specimens without starting a lab:

1. Navigate to **Specimen Library** in the sidebar.
2. Browse the card grid showing each animal with its thumbnail, scientific name, and category.
3. Use the **search bar** to find animals by name.
4. Use the **Category filter** to show only specific groups (e.g., mammals, amphibians).
5. Each card shows the number of dissection models and which organ systems are available.

This is a great place to familiarize yourself with the available specimens before starting a lab.

---

## For Instructors

### Instructor Dashboard

Your Dashboard provides an overview of your course:

- **Stats row** showing:
  - **Active Labs** &mdash; Number of published labs.
  - **Total Attempts** &mdash; Combined student attempts across all labs.
  - **Pending Grades** &mdash; Submissions awaiting review.
  - **Canvas Synced** &mdash; Grade sync status.

- **Your Labs** &mdash; Cards for each lab you've created, showing:
  - Title, animal, organ systems, structure count, and lab type.
  - Published/Draft status.
  - Attempt count.
  - **Edit** button &mdash; Open the Lab Builder to modify settings.
  - **Results** button &mdash; Jump directly to the Grade Center for that lab.

- **Create New Lab** card (dashed border) &mdash; Click to open the Lab Builder wizard.

### Creating a Lab

The Lab Builder is a 6-step wizard that guides you through creating a complete lab assignment.

#### Step 1: Select Animal

Choose the animal specimen for your lab:

- Browse the animal card grid showing thumbnails, names, and categories.
- Click an animal to select it (a blue border and checkmark appear).
- Each card shows the number of available models and organ systems.

> **Note:** Changing the animal resets all subsequent steps (organ systems, structures, rubric).

#### Step 2: Choose Organ Systems

Select which organ systems to include:

- Check the systems you want from the list (each shows a colored indicator).
- Use **Select All** / **Deselect All** to quickly toggle everything.
- A counter shows "X of Y selected."

Available systems vary by animal. Common systems include cardiovascular, digestive, respiratory, and nervous.

#### Step 3: Pick Structures

Choose the specific anatomical structures students will identify:

- A searchable data grid lists all structures from your selected systems.
- **Checkbox** each structure to include it in the lab.
- Filter by organ system using the chip buttons above the grid.
- Use **"All {system}"** buttons to bulk-select entire systems.
- For each selected structure, you can customize:
  - **Points** &mdash; How much the structure is worth (default: 1).
  - **Required** &mdash; Whether the structure must be answered (default: yes).

A summary shows the total selected structures and point values.

#### Step 4: Configure Rubric

Fine-tune grading for each structure:

- Expand each structure's accordion to configure:
  - **Accepted Aliases** &mdash; Add alternative names that will be marked correct (e.g., "AV valve" for "atrioventricular valve"). Type the alias and press Enter.
  - **Hint Penalty** &mdash; Percentage deducted per hint used (0-50%, default: 10%).
  - **Spelling Tolerance** &mdash; Accept answers within 2 character edits (default: on).
  - **Partial Credit** &mdash; Award 50% for fuzzy matches (default: off).

- If your lab covers multiple organ systems, you can set **Category Weights** to weight systems differently (e.g., cardiovascular worth 60%, digestive worth 40%).

#### Step 5: Lab Settings

Configure the overall lab parameters:

| Setting | Description | Default |
|---------|-------------|---------|
| **Lab Title** | Name shown to students (required, max 255 characters) | &mdash; |
| **Instructions** | Detailed directions displayed before the lab begins | &mdash; |
| **Lab Type** | Identification, Dissection, Quiz, or Practical | Identification |
| **Due Date** | Optional deadline | &mdash; |
| **Time Limit** | 0-180 minutes (0 = no limit) | No limit |
| **Attempts Allowed** | 1, 2, 3, 5, 10, or Unlimited | 1 |
| **Passing Threshold** | Minimum percentage to pass (0-100%) | 60% |
| **Show Hints** | Allow students to request hints | On |
| **Randomize Order** | Randomize which structures are highlighted per student | Off |

#### Step 6: Review and Publish

Review your complete lab configuration before publishing:

- **Lab Summary** table showing all settings at a glance.
- **Structure Details** table listing every structure with its points, required status, aliases, and hint penalty.
- **Validation warnings** appear as red alerts if required fields are missing.

**Two publishing options:**
- **Save as Draft** &mdash; Saves the lab without making it available to students. You can continue editing later.
- **Publish to Canvas** &mdash; Saves and publishes the lab, making it available to students. If Canvas is connected, it also creates the assignment in Canvas.

### Editing a Lab

To edit an existing lab:

1. From the Dashboard, click **Edit** on any lab card.
2. The Lab Builder opens with all existing settings pre-filled.
3. Navigate through the steps to make changes.
4. Save as Draft or Publish when done.

### Grade Center

The Grade Center is your hub for reviewing student submissions and managing grades.

**Accessing it:**
- Click **Grade Center** in the sidebar to see all labs, or
- Click **Results** on a specific lab card to jump directly to that lab's grades.

**Page layout:**

1. **Header** with a **LIVE** indicator (green pulsing dot when real-time updates are active) and subtitle.
2. **Action buttons:**
   - **Export CSV** &mdash; Download grades as a spreadsheet with columns for student name, email, attempt number, status, score, percentage, and Canvas sync status.
   - **Sync All to Canvas** &mdash; Push all graded scores to Canvas's gradebook in one click.
3. **Filters:**
   - **Lab selector** &mdash; Choose which lab's grades to view.
   - **Status filter** &mdash; Show all, or filter by graded/submitted/in-progress/not-started.
   - **Summary chips** showing total students, graded count, pending count, and class average.

**Grade table columns:**

| Column | Description |
|--------|-------------|
| Student | Name and email |
| Attempt | Attempt number (e.g., #1, #2) |
| Score | Percentage with color coding (green ≥85%, amber 70-85%, red <70%) |
| Status | Current status (graded, submitted, in progress, not started) |
| Submitted | Date and time of submission |
| Canvas | Sync status icon (green check = synced, red X = failed, amber clock = pending) |

Click any row to open the **Attempt Review** drawer.

**Real-time updates:**
When a student submits a lab or a grade is updated, the Grade Center automatically refreshes without needing to reload the page. The green "LIVE" indicator confirms the WebSocket connection is active.

### Reviewing Student Attempts

Click any row in the Grade Center table to open the **Attempt Review** drawer:

**Student information:**
- Student name, email, and attempt number.
- Submission date, time spent, and current status.

**Score banner:**
- Large percentage display with color coding.
- Raw score (e.g., "18 / 20 points").
- "PASSING" or "FAILING" indicator based on the lab's passing threshold.

**Structure-by-structure breakdown:**
Each structure shows:
- Structure name and Latin name.
- Correct/Incorrect status indicator.
- The student's answer vs. the correct answer, displayed side by side.
- Difficulty level and hint penalty information.
- An override field for manually adjusting the score (see [Grade Overrides](#grade-overrides)).

**Instructor Feedback:**
A text area where you can type personalized feedback for the student. This feedback appears on the student's Results page.

### Grade Overrides

To manually adjust a student's grade for a specific structure:

1. Open the Attempt Review drawer by clicking a student's row.
2. Find the structure you want to override.
3. Enter the new point value in the **override field**.
4. Optionally type feedback in the **Instructor Feedback** text area.
5. Click **Save Changes**.

Overrides are useful when:
- A student's answer was close enough to be considered correct but didn't match the fuzzy matching threshold.
- You want to give partial credit for a partially correct answer.
- You need to adjust for special circumstances.

### Canvas Grade Sync

AnatoView can automatically push grades to your Canvas gradebook:

**Sync a single student:**
1. Open the Attempt Review drawer.
2. Click **Sync to Canvas** at the bottom of the drawer.
3. The sync status icon in the grade table updates to reflect the result.

**Sync all students:**
1. Click **Sync All to Canvas** at the top of the Grade Center.
2. All graded attempts are pushed to Canvas.
3. A success or error message appears.

**Sync status indicators:**
- Green checkmark &mdash; Successfully synced to Canvas.
- Red X &mdash; Sync failed (check Canvas connection).
- Amber clock &mdash; Sync pending.
- Gray icon &mdash; Not yet synced.

Grade syncing is processed in the background by a dedicated worker service, so large classes won't block the interface.

### Analytics

The Analytics page provides visual insights into class performance:

**Accessing it:** Click **Analytics** in the sidebar, then select a lab from the dropdown.

**Overview stats (4 cards):**
- **Total Attempts** &mdash; Number of student submissions.
- **Average Score** &mdash; Class average percentage.
- **Median Score** &mdash; Middle score value.
- **Average Time** &mdash; Average time students spent on the lab.

**Charts:**

1. **Score Distribution** &mdash; Bar chart showing how many students scored in each range (e.g., 0-10%, 10-20%, etc.). Helps identify if the lab difficulty is appropriate.

2. **Average Score Over Time** &mdash; Line chart showing how class performance trends across submission dates. Useful for spotting improvement over time.

3. **Structure Accuracy (Hardest First)** &mdash; Horizontal bar chart showing the accuracy rate for each structure, sorted from hardest to easiest. Bars are color-coded: green (≥85%), amber (70-85%), red (<70%). This helps you identify which structures students struggle with most.

4. **Average Hints Used by Structure** &mdash; Horizontal bar chart showing which structures students request the most hints for.

5. **Average Time Per Structure** &mdash; Horizontal bar chart showing how long students spend on each structure. Longer times may indicate difficulty or confusion.

6. **Accuracy by Difficulty Level** &mdash; Grouped bar chart comparing accuracy rates across Easy, Medium, and Hard structures.

### Managing Specimens

The Specimen Management page lets you add, edit, and organize animal specimens.

**Accessing it:** Click **Manage Specimens** in the sidebar, or click the **Manage Specimens** button in the Specimen Library.

**Animals Tab:**

A table listing all specimens with columns:
- Thumbnail, name, scientific name, category, model count, status, and actions.
- **Edit** (pencil icon) &mdash; Opens the animal form dialog.
- **Toggle visibility** (eye icon) &mdash; Marks an animal as active/inactive. Inactive animals are dimmed and hidden from the Specimen Library.

**Adding a new animal:**
1. Click **Add Specimen**.
2. Fill in the form:
   - **Common Name** (required) &mdash; e.g., "Domestic Cat"
   - **Scientific Name** (optional) &mdash; e.g., "Felis catus"
   - **Category** (required) &mdash; Select from existing categories
   - **Description** (optional) &mdash; Background information
   - **Model Type** &mdash; SVG (2D Illustration), Three.js (3D Model), or Photographic
   - **Thumbnail** &mdash; Upload an image (PNG, JPEG, WebP, or SVG, max 5 MB)
3. Click **Add Specimen**.

**Categories Tab:**

Manage the groupings used to organize animals:
- Each category has a name, color, icon, and sort order.
- You can create, edit, or delete categories.
- Categories with assigned animals cannot be deleted.

---

## The Dissection Viewer

The dissection viewer is the core interactive component of AnatoView. It renders SVG anatomical models on an HTML5 canvas with full zoom, pan, and interaction capabilities.

### Canvas Controls

**Zooming:**
- **Mouse wheel** &mdash; Scroll up to zoom in, scroll down to zoom out. Zoom is centered on your cursor position.
- **Toolbar buttons** &mdash; Click the + and - buttons at the bottom of the canvas.
- **Zoom range** &mdash; 25% to 400%.
- **Reset View** &mdash; Click the center/crosshair button in the toolbar to reset to 100% zoom and re-center the model.

The current zoom level is displayed as a percentage in the bottom-right corner of the canvas.

**Panning:**
- Click and drag on empty space in the canvas to pan around the model.
- This is especially useful when zoomed in to examine fine structures.

### Layer Panel

The Layer Panel (right sidebar) lets you control which organ systems are visible on the canvas:

- Each system has a **toggle switch** to show/hide it.
- Click the **system name chip** to isolate that system (hide everything else and show only that system).
- Click the chip again to deactivate isolation and show all systems.
- A counter at the bottom shows how many systems are currently hidden.

Toggling layers is useful for:
- Focusing on one system at a time to reduce visual clutter.
- Examining how different systems overlap anatomically.
- Finding structures that may be hidden behind other systems.

### Dissection Modes

The toolbar at the bottom of the canvas has three mode buttons:

#### Explore Mode (compass icon)
- **Purpose:** Free exploration and studying without answering questions.
- **Behavior:** Clicking a structure opens a **popover** with detailed information:
  - Structure name and Latin name.
  - Difficulty level and tags.
  - Description and fun facts (when available).
  - Blood supply, innervation, muscle attachments, and clinical notes (when available).
  - A pronunciation button (when audio is available).
  - A "Show Hint" button (with penalty warning).
- **Labels:** Structure name labels appear when you hover over or select a structure.
- **Best for:** Studying before a lab, reviewing anatomy after a lab.

#### Identify Mode (touch icon)
- **Purpose:** Structured identification practice &mdash; type the name of each structure.
- **Behavior:** Clicking a structure selects it and activates the Answer Input in the sidebar.
- **Labels:** Appear on hover, when selected, or after answering.
- **Best for:** Practicing identification with immediate feedback.

#### Quiz Mode (quiz icon)
- **Purpose:** Blind testing &mdash; structure names are hidden until correctly answered.
- **Behavior:** Same as Identify mode, but labels are only revealed after you answer correctly.
- **Labels:** Hidden until you answer correctly. This simulates exam conditions.
- **Best for:** Self-testing and exam preparation.

### Structure Search

The search bar at the top of the right sidebar lets you find structures by name:

1. Type a structure name (or part of it) in the search field.
2. Matching results appear in a dropdown (up to 8 results).
3. Each result shows the structure name, Latin name, and difficulty level.
4. If a structure is in a hidden layer, a small warning label appears.
5. Click a result to zoom to and select that structure. If its layer is hidden, it will be automatically revealed.

---

## Available Specimens

AnatoView includes the following animal specimens and dissection models:

| Animal | Scientific Name | Category | Models | Total Structures |
|--------|----------------|----------|:------:|:----------------:|
| Domestic Cat | *Felis catus* | Mammal | Cardiovascular, Digestive | 35 |
| Norway Rat | *Rattus norvegicus* | Mammal | Cardiovascular | 14 |
| Fetal Pig | *Sus scrofa domesticus* | Mammal | Cardiovascular | 18 |
| Leopard Frog | *Rana pipiens* | Amphibian | Cardiovascular | 12 |
| Earthworm | *Lumbricus terrestris* | Annelid | Cardiovascular | 10 |
| Grasshopper | *Romalea microptera* | Arthropod | Cardiovascular | 10 |
| Crayfish | *Procambarus clarkii* | Arthropod | Cardiovascular | 10 |

**Notable comparative anatomy features:**
- **Fetal Pig** includes fetal-specific structures: ductus arteriosus, foramen ovale, and umbilical vessels.
- **Leopard Frog** features a three-chambered heart with sinus venosus and conus arteriosus.
- **Earthworm** demonstrates aortic arches (hearts) and the dorsal/ventral vessel circulatory pattern.
- **Grasshopper and Crayfish** show open circulatory systems with dorsal heart tubes.

---

## Grading System

AnatoView uses an automated grading pipeline with several layers of matching:

### How Answers Are Graded

1. **Normalization** &mdash; Your answer is converted to lowercase, punctuation is removed, and extra spaces are collapsed.
2. **Exact matching** &mdash; Your normalized answer is compared against:
   - The correct structure name.
   - The Latin/scientific name.
   - Any accepted aliases added by your instructor.
3. **Fuzzy matching** &mdash; If no exact match is found and your answer is at least 3 characters, the system checks if your answer is within 2 character edits (Levenshtein distance) of any correct answer. This allows for minor typos and spelling variations.
4. **Partial credit** &mdash; If enabled by your instructor, fuzzy matches receive 90% credit (1 edit away) or 80% credit (2 edits away) instead of full credit.

### Hint Penalties

Each hint you use for a structure reduces your score for that structure:
- The penalty is set by your instructor (typically 10% per hint).
- Multiple hints stack (e.g., 2 hints at 10% = 20% reduction).
- Your score for a structure cannot go below zero.

### Score Calculation

Your total lab score is calculated as:
- Sum of points earned across all structures.
- Each structure's points = base points &times; correctness &times; (1 - hint penalty).
- If category weighting is configured, systems are weighted according to the instructor's percentages.
- Your percentage = (total earned / max possible) &times; 100.

---

## Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| Enter | Submit answer | Answer Input field |
| Escape | Close popover/drawer | Structure Popover, Hint Drawer |
| Mouse wheel | Zoom in/out | Dissection canvas |
| Click + drag | Pan the canvas | Dissection canvas (empty area) |

---

## Troubleshooting

### "Access Denied" page

This usually means you accessed AnatoView directly instead of through Canvas. Solutions:
- Launch AnatoView from your Canvas course assignment.
- If you believe you should have access, contact your instructor or IT department.

### Dissection model not loading

If the SVG model doesn't appear in the canvas:
- Check your internet connection.
- Try refreshing the page.
- Clear your browser cache and try again.
- Contact your instructor if the issue persists.

### Timer started but I'm not ready

The timer begins when you click **Start Lab**. If your instructor set a time limit:
- There is no way to pause the timer once started.
- Make sure you've reviewed the instructions and structure list before clicking Start.
- If there is no time limit, you can leave and come back &mdash; your progress is saved automatically.

### My answer was marked incorrect but I think it's right

The grading system accepts:
- The exact structure name (case-insensitive).
- The Latin name.
- Any aliases your instructor added.
- Close spellings within 2 character edits.

If you believe your answer should have been accepted, contact your instructor. They can:
- Add your answer as an accepted alias for future students.
- Override your grade in the Grade Center.

### Can't find a structure on the canvas

Try these approaches:
1. Use the **Structure Search** bar in the right sidebar to find and zoom to the structure.
2. Check the **Layer Panel** &mdash; the structure's organ system might be hidden. Toggle layers to reveal it.
3. **Zoom in** to the area where you expect the structure to be.
4. Switch to **Explore mode** and hover over structures to see their names.

### Progress not saving

AnatoView saves your answers automatically as you go. If you're concerned:
- Make sure you have a stable internet connection.
- Check for error messages in the top bar of the dissection view.
- Your progress should be restored if you leave and come back (as long as you haven't submitted).

### Canvas grades not appearing

If your grade doesn't appear in Canvas after submission:
- Allow a few minutes for the background sync to process.
- Ask your instructor to check the Grade Center sync status.
- The instructor can manually trigger a Canvas sync from the Grade Center.
