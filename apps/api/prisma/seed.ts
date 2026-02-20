import { PrismaClient, ModelType } from '@prisma/client';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ─── S3 Configuration ─────────────────────────────────────────────────
const S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localstack:4566';
const S3_BUCKET = process.env.S3_BUCKET ?? 'anatoview-assets';
const S3_REGION = process.env.S3_REGION ?? 'us-east-1';

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
  },
});

// ─── S3 Helpers ───────────────────────────────────────────────────────

async function isS3Available(): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    return true;
  } catch (err: unknown) {
    // If bucket doesn't exist, try to create it
    const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      try {
        await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
        console.log(`  ✓ Created S3 bucket: ${S3_BUCKET}`);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

async function uploadToS3(
  filePath: string,
  s3Key: string,
  contentType: string,
): Promise<string | null> {
  try {
    const fileContent = fs.readFileSync(filePath);
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
        ACL: 'public-read',
      }),
    );
    const url = `${S3_ENDPOINT}/${S3_BUCKET}/${s3Key}`;
    return url;
  } catch (err) {
    console.warn(`  ⚠ S3 upload failed for ${s3Key}:`, (err as Error).message);
    return null;
  }
}

/**
 * Resolves the local file path to an SVG model.
 * Handles both Docker (CWD = /app) and host-machine environments.
 */
function resolveModelPath(relativePath: string): string | null {
  // In Docker, the context is /app (api root) — models are in /app/../infrastructure/models
  const candidates = [
    // Docker: /app is apps/api, so ../../infrastructure/models
    path.resolve(process.cwd(), '..', '..', 'infrastructure', 'models', relativePath),
    // Host: running from project root
    path.resolve(process.cwd(), 'infrastructure', 'models', relativePath),
    // Host: running from apps/api
    path.resolve(process.cwd(), '..', '..', 'infrastructure', 'models', relativePath),
    // Explicit MODELS_DIR env var
    ...(process.env.MODELS_DIR
      ? [path.resolve(process.env.MODELS_DIR, relativePath)]
      : []),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

// ─── Main Seed ────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       AnatoView — Database Seed                 ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // ─── Check S3 availability ──────────────────────────────────────
  const s3Available = await isS3Available();
  if (s3Available) {
    console.log(`  ✓ S3 available at ${S3_ENDPOINT} (bucket: ${S3_BUCKET})`);
  } else {
    console.log(`  ⚠ S3 not available — model URLs will use placeholder values`);
  }
  console.log('');

  // ─── CATEGORIES ──────────────────────────────────────────────────

  console.log('── Categories ──────────────────────────────────────');

  const defaultCategories = [
    { id: 'category-mammal',    name: 'mammal',    color: '#1B4F72', icon: 'Pets',       sortOrder: 0 },
    { id: 'category-amphibian', name: 'amphibian', color: '#27AE60', icon: 'Water',      sortOrder: 1 },
    { id: 'category-annelid',   name: 'annelid',   color: '#8E44AD', icon: 'Straighten', sortOrder: 2 },
    { id: 'category-arthropod', name: 'arthropod', color: '#E67E22', icon: 'BugReport',  sortOrder: 3 },
  ];

  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { color: cat.color, icon: cat.icon, sortOrder: cat.sortOrder },
      create: cat,
    });
    console.log(`  ✓ ${cat.name} (${cat.color})`);
  }

  console.log('');

  // ─── ANIMALS ────────────────────────────────────────────────────

  console.log('── Animals ──────────────────────────────────────────');

  const cat = await prisma.animal.upsert({
    where: { id: 'animal-cat-001' },
    update: {},
    create: {
      id: 'animal-cat-001',
      commonName: 'Domestic Cat',
      scientificName: 'Felis catus',
      categoryId: 'category-mammal',
      description:
        'The domestic cat is one of the most commonly used specimens in comparative vertebrate anatomy courses. Its cardiovascular, digestive, respiratory, urogenital, skeletal, muscular, and nervous systems closely parallel those of other mammals, making it an excellent model for pre-veterinary students to study organ relationships and surgical landmarks.',
      thumbnailUrl: null,
      modelType: ModelType.svg,
      isActive: true,
    },
  });
  console.log(`  ✓ ${cat.commonName} (${cat.id})`);

  const rat = await prisma.animal.upsert({
    where: { id: 'animal-rat-001' },
    update: {},
    create: {
      id: 'animal-rat-001',
      commonName: 'Norway Rat',
      scientificName: 'Rattus norvegicus',
      categoryId: 'category-mammal',
      description:
        'The Norway rat is a standard laboratory mammal whose compact body plan allows students to trace cardiovascular circuits, digestive pathways, respiratory branching, and urogenital anatomy in a single specimen. Its size makes it ideal for introductory dissection courses.',
      thumbnailUrl: null,
      modelType: ModelType.svg,
      isActive: true,
    },
  });
  console.log(`  ✓ ${rat.commonName} (${rat.id})`);

  const fetalPig = await prisma.animal.upsert({
    where: { id: 'animal-pig-001' },
    update: {},
    create: {
      id: 'animal-pig-001',
      commonName: 'Fetal Pig',
      scientificName: 'Sus scrofa',
      categoryId: 'category-mammal',
      description:
        'The fetal pig is widely used in anatomy education because its organ systems are strikingly similar to those of humans. Students can examine cardiovascular shunts unique to fetal circulation (ductus arteriosus, foramen ovale), a complete digestive tract, and developing urogenital organs.',
      thumbnailUrl: null,
      modelType: ModelType.svg,
      isActive: true,
    },
  });
  console.log(`  ✓ ${fetalPig.commonName} (${fetalPig.id})`);

  const frog = await prisma.animal.upsert({
    where: { id: 'animal-frog-001' },
    update: {},
    create: {
      id: 'animal-frog-001',
      commonName: 'Leopard Frog',
      scientificName: 'Lithobates pipiens',
      categoryId: 'category-amphibian',
      description:
        'The leopard frog provides an accessible introduction to vertebrate anatomy with its three-chambered heart, simple lung structure, and clearly visible digestive organs. Its semi-transparent mesentery and large liver make organ identification straightforward for beginning students.',
      thumbnailUrl: null,
      modelType: ModelType.svg,
      isActive: true,
    },
  });
  console.log(`  ✓ ${frog.commonName} (${frog.id})`);

  const earthworm = await prisma.animal.upsert({
    where: { id: 'animal-worm-001' },
    update: {},
    create: {
      id: 'animal-worm-001',
      commonName: 'Earthworm',
      scientificName: 'Lumbricus terrestris',
      categoryId: 'category-annelid',
      description:
        'The earthworm demonstrates segmented body organization and a closed circulatory system with five aortic arches (often called "hearts"). Its simple nervous system with ventral nerve cord and straightforward digestive tube (pharynx, crop, gizzard, intestine) make it an excellent model for invertebrate comparative anatomy.',
      thumbnailUrl: null,
      modelType: ModelType.svg,
      isActive: true,
    },
  });
  console.log(`  ✓ ${earthworm.commonName} (${earthworm.id})`);

  const grasshopper = await prisma.animal.upsert({
    where: { id: 'animal-grasshopper-001' },
    update: {},
    create: {
      id: 'animal-grasshopper-001',
      commonName: 'Grasshopper',
      scientificName: 'Melanoplus sp.',
      categoryId: 'category-arthropod',
      description:
        'The grasshopper illustrates arthropod anatomy with its open circulatory system, tracheal respiratory network, and a complete digestive system with specialized mouthparts. Students can examine the gastric caeca, Malpighian tubules, and the distinctive reproductive structures that differ markedly from vertebrate models.',
      thumbnailUrl: null,
      modelType: ModelType.svg,
      isActive: true,
    },
  });
  console.log(`  ✓ ${grasshopper.commonName} (${grasshopper.id})`);

  const crayfish = await prisma.animal.upsert({
    where: { id: 'animal-crayfish-001' },
    update: {},
    create: {
      id: 'animal-crayfish-001',
      commonName: 'Crayfish',
      scientificName: 'Procambarus clarkii',
      categoryId: 'category-arthropod',
      description:
        'The crayfish is a crustacean model that showcases an open circulatory system with a dorsal heart, gill-based respiration, and a digestive system featuring a gastric mill for mechanical food processing. Its well-defined nervous system with cerebral ganglia and ventral nerve cord illustrates arthropod neural organization.',
      thumbnailUrl: null,
      modelType: ModelType.svg,
      isActive: true,
    },
  });
  console.log(`  ✓ ${crayfish.commonName} (${crayfish.id})`);

  console.log('');

  // ─── CAT CARDIOVASCULAR DISSECTION MODEL ────────────────────────

  console.log('── Dissection Models ────────────────────────────────');

  // Upload SVG to S3 if available
  const catCardioSvgRelPath = 'cat/cardiovascular/model.svg';
  const catCardioS3Key = `models/${catCardioSvgRelPath}`;
  const placeholderUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${catCardioS3Key}`;
  let catCardioModelUrl = placeholderUrl;

  if (s3Available) {
    const localPath = resolveModelPath(catCardioSvgRelPath);
    if (localPath) {
      const uploadedUrl = await uploadToS3(localPath, catCardioS3Key, 'image/svg+xml');
      if (uploadedUrl) {
        catCardioModelUrl = uploadedUrl;
        console.log(`  ✓ Uploaded ${catCardioSvgRelPath} to S3`);
      }
    } else {
      console.log(`  ⚠ SVG not found locally: ${catCardioSvgRelPath} (using placeholder URL)`);
    }
  }

  const catCardioModel = await prisma.dissectionModel.upsert({
    where: { id: 'model-cat-cardio-001' },
    update: {
      modelFileUrl: catCardioModelUrl,
    },
    create: {
      id: 'model-cat-cardio-001',
      animalId: cat.id,
      version: '1.0.0',
      organSystem: 'cardiovascular',
      modelFileUrl: catCardioModelUrl,
      thumbnailUrl: null,
      layerOrder: 0,
      isPublished: true,
    },
  });
  console.log(`  ✓ Cat Cardiovascular v${catCardioModel.version} → ${catCardioModelUrl}`);

  // ─── CAT DIGESTIVE DISSECTION MODEL ─────────────────────────────

  const catDigestiveSvgRelPath = 'cat/digestive/model.svg';
  const catDigestiveS3Key = `models/${catDigestiveSvgRelPath}`;
  let catDigestiveModelUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${catDigestiveS3Key}`;

  if (s3Available) {
    const localPath = resolveModelPath(catDigestiveSvgRelPath);
    if (localPath) {
      const uploadedUrl = await uploadToS3(localPath, catDigestiveS3Key, 'image/svg+xml');
      if (uploadedUrl) {
        catDigestiveModelUrl = uploadedUrl;
        console.log(`  ✓ Uploaded ${catDigestiveSvgRelPath} to S3`);
      }
    } else {
      console.log(`  ⚠ SVG not found locally: ${catDigestiveSvgRelPath} (using placeholder URL)`);
    }
  }

  const catDigestiveModel = await prisma.dissectionModel.upsert({
    where: { id: 'model-cat-digestive-001' },
    update: {
      modelFileUrl: catDigestiveModelUrl,
      isPublished: true,
    },
    create: {
      id: 'model-cat-digestive-001',
      animalId: cat.id,
      version: '1.0.0',
      organSystem: 'digestive',
      modelFileUrl: catDigestiveModelUrl,
      thumbnailUrl: null,
      layerOrder: 1,
      isPublished: true,
    },
  });
  console.log(`  ✓ Cat Digestive v${catDigestiveModel.version} → ${catDigestiveModelUrl}`);

  // ─── Helper to create model with S3 upload ────────────────────
  async function createModelWithUpload(
    id: string,
    animalId: string,
    organSystem: string,
    svgRelPath: string,
    layerOrder = 0,
  ) {
    const s3Key = `models/${svgRelPath}`;
    let modelUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${s3Key}`;
    if (s3Available) {
      const localPath = resolveModelPath(svgRelPath);
      if (localPath) {
        const uploaded = await uploadToS3(localPath, s3Key, 'image/svg+xml');
        if (uploaded) {
          modelUrl = uploaded;
          console.log(`  ✓ Uploaded ${svgRelPath} to S3`);
        }
      } else {
        console.log(`  ⚠ SVG not found locally: ${svgRelPath} (using placeholder URL)`);
      }
    }
    const model = await prisma.dissectionModel.upsert({
      where: { id },
      update: { modelFileUrl: modelUrl, isPublished: true },
      create: {
        id,
        animalId,
        version: '1.0.0',
        organSystem,
        modelFileUrl: modelUrl,
        thumbnailUrl: null,
        layerOrder,
        isPublished: true,
      },
    });
    console.log(`  ✓ ${organSystem} model → ${modelUrl}`);
    return model;
  }

  // ─── RAT CARDIOVASCULAR MODEL ──────────────────────────────────
  const ratCardioModel = await createModelWithUpload(
    'model-rat-cardio-001', rat.id, 'cardiovascular', 'rat/cardiovascular/model.svg',
  );

  // ─── FETAL PIG CARDIOVASCULAR MODEL ────────────────────────────
  const pigCardioModel = await createModelWithUpload(
    'model-pig-cardio-001', fetalPig.id, 'cardiovascular', 'pig/cardiovascular/model.svg',
  );

  // ─── FROG CARDIOVASCULAR MODEL ─────────────────────────────────
  const frogCardioModel = await createModelWithUpload(
    'model-frog-cardio-001', frog.id, 'cardiovascular', 'frog/cardiovascular/model.svg',
  );

  // ─── EARTHWORM CARDIOVASCULAR MODEL ────────────────────────────
  const wormCardioModel = await createModelWithUpload(
    'model-worm-cardio-001', earthworm.id, 'cardiovascular', 'worm/cardiovascular/model.svg',
  );

  // ─── GRASSHOPPER CARDIOVASCULAR MODEL ──────────────────────────
  const grasshopperCardioModel = await createModelWithUpload(
    'model-grasshopper-cardio-001', grasshopper.id, 'cardiovascular', 'grasshopper/cardiovascular/model.svg',
  );

  // ─── CRAYFISH CARDIOVASCULAR MODEL ─────────────────────────────
  const crayfishCardioModel = await createModelWithUpload(
    'model-crayfish-cardio-001', crayfish.id, 'cardiovascular', 'crayfish/cardiovascular/model.svg',
  );

  console.log('');

  // ─── CAT CARDIOVASCULAR STRUCTURES (20) ─────────────────────────

  console.log('── Anatomical Structures ────────────────────────────');

  interface SeedStructure {
    id: string;
    name: string;
    latinName: string;
    svgElementId: string;
    description: string;
    funFact: string | null;
    hint: string;
    difficultyLevel: string;
    tags: string[];
    bloodSupply?: string;
    innervation?: string;
    muscleAttachments?: string;
    clinicalNote?: string;
    pronunciationUrl?: string;
  }

  const cardiovascularStructures: SeedStructure[] = [
    {
      id: 'struct-cat-cv-001',
      name: 'Left Ventricle',
      latinName: 'Ventriculus sinister',
      svgElementId: 'left-ventricle',
      description:
        'The left ventricle is the thickest-walled chamber of the heart, responsible for pumping oxygenated blood through the aorta to the entire body. Its muscular wall is approximately three times thicker than the right ventricle.',
      funFact:
        'A cat\'s left ventricle can generate enough pressure to push blood through over 60,000 miles of blood vessels in its small body.',
      hint: 'Look for the thick-walled chamber on the left side (anatomical left) of the heart, closest to the apex.',
      difficultyLevel: 'easy',
      tags: ['heart', 'chamber', 'systemic-circuit'],
      bloodSupply: 'Left coronary artery (left anterior descending and circumflex branches)',
      innervation: 'Vagus nerve (CN X) parasympathetic; sympathetic cardiac nerves from stellate ganglion',
      muscleAttachments: 'Papillary muscles anchor chordae tendineae to the mitral valve cusps',
      clinicalNote: 'Hypertrophic cardiomyopathy (HCM) is the most common heart disease in cats, causing thickening of the left ventricular wall.',
    },
    {
      id: 'struct-cat-cv-002',
      name: 'Right Ventricle',
      latinName: 'Ventriculus dexter',
      svgElementId: 'right-ventricle',
      description:
        'The right ventricle receives deoxygenated blood from the right atrium and pumps it to the lungs via the pulmonary arteries. Its wall is thinner than the left ventricle since it only needs to push blood to the nearby lungs.',
      funFact:
        'The right ventricle wraps around the front of the left ventricle in a crescent shape, which is visible when viewing the heart in cross-section.',
      hint: 'Find the thinner-walled chamber on the right side of the heart. It sits anterior to the left ventricle.',
      difficultyLevel: 'easy',
      tags: ['heart', 'chamber', 'pulmonary-circuit'],
      bloodSupply: 'Right coronary artery (right marginal branch)',
      innervation: 'Vagus nerve (CN X) parasympathetic; sympathetic cardiac nerves',
      muscleAttachments: 'Papillary muscles anchor chordae tendineae to the tricuspid valve cusps',
      clinicalNote: 'Right ventricular dilation can indicate heartworm disease or pulmonic stenosis in cats.',
    },
    {
      id: 'struct-cat-cv-003',
      name: 'Left Atrium',
      latinName: 'Atrium sinistrum',
      svgElementId: 'left-atrium',
      description:
        'The left atrium is a thin-walled receiving chamber that collects oxygenated blood returning from the lungs via the pulmonary veins. It passes this blood to the left ventricle through the mitral (bicuspid) valve.',
      funFact:
        'The left atrium has a small ear-shaped appendage called the auricle that increases its volume and can be a site where blood clots form in cats with heart disease.',
      hint: 'This chamber sits at the top-left of the heart (posterior view) and receives the pulmonary veins.',
      difficultyLevel: 'easy',
      tags: ['heart', 'chamber', 'pulmonary-circuit'],
      bloodSupply: 'Left circumflex coronary artery',
      innervation: 'Vagus nerve (CN X); sympathetic cardiac nerves',
      clinicalNote: 'Left atrial enlargement on echocardiography is an early indicator of HCM and increases risk of aortic thromboembolism.',
    },
    {
      id: 'struct-cat-cv-004',
      name: 'Right Atrium',
      latinName: 'Atrium dextrum',
      svgElementId: 'right-atrium',
      description:
        'The right atrium is the first chamber to receive deoxygenated blood returning from the body via the superior and inferior vena cava. It contracts to push blood through the tricuspid valve into the right ventricle.',
      funFact:
        'The sinoatrial (SA) node — the heart\'s natural pacemaker — is located in the wall of the right atrium, near where the superior vena cava enters.',
      hint: 'Look at the top-right of the heart. This chamber connects directly to both the superior and inferior vena cava.',
      difficultyLevel: 'easy',
      tags: ['heart', 'chamber', 'systemic-circuit'],
      bloodSupply: 'Right coronary artery (SA nodal branch)',
      innervation: 'Vagus nerve (CN X); sympathetic fibers to the SA and AV nodes',
      clinicalNote: 'The SA node in the right atrial wall controls heart rhythm; damage can cause sick sinus syndrome.',
    },
    {
      id: 'struct-cat-cv-005',
      name: 'Aorta',
      latinName: 'Aorta',
      svgElementId: 'aorta',
      description:
        'The aorta is the largest artery in the body. It arises from the left ventricle, arches superiorly and posteriorly, then descends through the thorax and abdomen. Its elastic walls expand with each heartbeat to maintain steady blood pressure downstream.',
      funFact:
        'In a cat, the aorta is roughly the diameter of a drinking straw, yet it handles the entire cardiac output at pressures exceeding 120 mmHg.',
      hint: 'The large artery exiting the top of the heart, arching toward the left before descending posteriorly.',
      difficultyLevel: 'medium',
      tags: ['artery', 'great-vessel', 'systemic-circuit'],
      innervation: 'Sympathetic and parasympathetic fibers from the aortic plexus',
      clinicalNote: 'Feline aortic thromboembolism (FATE/saddle thrombus) is a life-threatening emergency where clots lodge at the aortic trifurcation.',
    },
    {
      id: 'struct-cat-cv-006',
      name: 'Pulmonary Trunk',
      latinName: 'Truncus pulmonalis',
      svgElementId: 'pulmonary-trunk',
      description:
        'The pulmonary trunk is the large arterial vessel that exits the right ventricle and bifurcates into the left and right pulmonary arteries, carrying deoxygenated blood to each lung for gas exchange.',
      funFact:
        'The pulmonary trunk is the only artery in the body that carries deoxygenated blood, which confuses many students who equate "artery" with "oxygenated."',
      hint: 'Find the large vessel leaving the right ventricle. It splits into two branches heading toward each lung.',
      difficultyLevel: 'medium',
      tags: ['artery', 'great-vessel', 'pulmonary-circuit'],
      innervation: 'Pulmonary plexus (sympathetic and vagal fibers)',
      clinicalNote: 'Heartworm disease (Dirofilaria immitis) can cause pulmonary artery obstruction and right heart failure in cats.',
    },
    {
      id: 'struct-cat-cv-007',
      name: 'Superior Vena Cava',
      latinName: 'Vena cava cranialis',
      svgElementId: 'superior-vena-cava',
      description:
        'The superior (cranial) vena cava is a large vein that returns deoxygenated blood from the head, neck, forelimbs, and anterior thorax to the right atrium. In cats it is often called the cranial vena cava.',
      funFact:
        'Cats, like some other mammals, actually have both a left and right cranial vena cava — most humans only have one on the right side.',
      hint: 'The large vein entering the right atrium from above, draining the head and front limbs.',
      difficultyLevel: 'medium',
      tags: ['vein', 'great-vessel', 'systemic-circuit'],
    },
    {
      id: 'struct-cat-cv-008',
      name: 'Inferior Vena Cava',
      latinName: 'Vena cava caudalis',
      svgElementId: 'inferior-vena-cava',
      description:
        'The inferior (caudal) vena cava is the largest vein in the body, returning deoxygenated blood from the abdomen, pelvis, and hind limbs to the right atrium. It passes through the diaphragm before entering the heart.',
      funFact:
        'The caudal vena cava of a cat passes through its own opening (the caval foramen) in the diaphragm, separate from the aortic hiatus and esophageal hiatus.',
      hint: 'The large vein entering the right atrium from below, passing through the diaphragm from the abdomen.',
      difficultyLevel: 'medium',
      tags: ['vein', 'great-vessel', 'systemic-circuit'],
    },
    {
      id: 'struct-cat-cv-009',
      name: 'Pulmonary Veins',
      latinName: 'Venae pulmonales',
      svgElementId: 'pulmonary-veins',
      description:
        'The pulmonary veins (typically two to three pairs in cats) return oxygenated blood from the lungs to the left atrium. They are the only veins in the body that carry oxygenated blood.',
      funFact:
        'Unlike most veins, pulmonary veins lack valves because the low pressure in the pulmonary circuit combined with gravity drains blood efficiently back to the heart.',
      hint: 'Look for the vessels entering the left atrium from the lungs on the posterior side of the heart.',
      difficultyLevel: 'medium',
      tags: ['vein', 'pulmonary-circuit'],
    },
    {
      id: 'struct-cat-cv-010',
      name: 'Mitral Valve',
      latinName: 'Valva mitralis (bicuspidalis)',
      svgElementId: 'mitral-valve',
      description:
        'The mitral (bicuspid) valve sits between the left atrium and left ventricle. Its two cusps open to allow oxygenated blood to flow into the ventricle during diastole, then snap shut during systole to prevent backflow.',
      funFact:
        'The mitral valve is named after its resemblance to a bishop\'s mitre (a tall pointed hat). It is the most commonly affected valve in feline heart disease.',
      hint: 'Located between the left atrium and left ventricle. It has two flaps (cusps), unlike the tricuspid valve which has three.',
      difficultyLevel: 'hard',
      tags: ['heart', 'valve'],
      bloodSupply: 'Left coronary artery branches',
      muscleAttachments: 'Chordae tendineae connect valve cusps to anterior and posterior papillary muscles',
      clinicalNote: 'Mitral valve regurgitation is detected via systolic heart murmur on auscultation; common in cats with HCM.',
    },
    {
      id: 'struct-cat-cv-011',
      name: 'Tricuspid Valve',
      latinName: 'Valva tricuspidalis',
      svgElementId: 'tricuspid-valve',
      description:
        'The tricuspid valve has three cusps and sits between the right atrium and right ventricle. It prevents backflow of blood into the right atrium when the right ventricle contracts.',
      funFact:
        'The chordae tendineae (tendinous cords) that anchor the tricuspid valve cusps to papillary muscles in the ventricle wall are sometimes called "heart strings."',
      hint: 'Found between the right atrium and right ventricle. Count the cusps — three means tricuspid.',
      difficultyLevel: 'hard',
      tags: ['heart', 'valve'],
    },
    {
      id: 'struct-cat-cv-012',
      name: 'Aortic Valve',
      latinName: 'Valva aortae',
      svgElementId: 'aortic-valve',
      description:
        'The aortic valve is a semilunar valve with three crescent-shaped cusps located at the junction of the left ventricle and the aorta. It prevents oxygenated blood from flowing back into the ventricle after each contraction.',
      funFact:
        'The coronary arteries that feed the heart muscle itself branch off from the aorta just above the aortic valve cusps, in pockets called the sinuses of Valsalva.',
      hint: 'A three-cusped semilunar valve at the exit of the left ventricle where the aorta begins.',
      difficultyLevel: 'hard',
      tags: ['heart', 'valve', 'semilunar'],
    },
    {
      id: 'struct-cat-cv-013',
      name: 'Pulmonary Valve',
      latinName: 'Valva trunci pulmonalis',
      svgElementId: 'pulmonary-valve',
      description:
        'The pulmonary (pulmonic) valve is a semilunar valve with three cusps at the exit of the right ventricle leading into the pulmonary trunk. It opens during ventricular systole to allow blood to flow to the lungs.',
      funFact:
        'The pulmonary valve operates at much lower pressures than the aortic valve (about 25 mmHg versus 120 mmHg), which is why pulmonary valve disease is rare in cats.',
      hint: 'Three-cusped semilunar valve where the right ventricle exits into the pulmonary trunk.',
      difficultyLevel: 'hard',
      tags: ['heart', 'valve', 'semilunar'],
    },
    {
      id: 'struct-cat-cv-014',
      name: 'Interventricular Septum',
      latinName: 'Septum interventriculare',
      svgElementId: 'interventricular-septum',
      description:
        'The interventricular septum is the thick muscular wall that divides the left and right ventricles. It prevents mixing of oxygenated and deoxygenated blood and contributes to the pumping action of both ventricles.',
      funFact:
        'A ventricular septal defect (VSD) — a hole in this septum — is one of the most common congenital heart defects in cats, allowing blood to shunt between chambers.',
      hint: 'The muscular partition running vertically between the two lower heart chambers.',
      difficultyLevel: 'medium',
      tags: ['heart', 'septum'],
    },
    {
      id: 'struct-cat-cv-015',
      name: 'Coronary Arteries',
      latinName: 'Arteriae coronariae',
      svgElementId: 'coronary-arteries',
      description:
        'The coronary arteries branch from the base of the aorta immediately above the aortic valve and supply oxygenated blood to the heart muscle (myocardium). The left and right coronary arteries run along the surface of the heart in the coronary sulcus.',
      funFact:
        'Unlike humans, cats rarely develop coronary artery disease or atherosclerosis, even on high-fat diets — making feline heart attacks extremely uncommon.',
      hint: 'Small arteries visible on the surface of the heart, branching from the very beginning of the aorta.',
      difficultyLevel: 'hard',
      tags: ['artery', 'heart', 'myocardium'],
      bloodSupply: 'Originate from sinuses of Valsalva immediately above the aortic valve',
      innervation: 'Sympathetic vasodilatory and parasympathetic fibers; coronary vasospasm possible',
      clinicalNote: 'Cats rarely develop coronary artery disease, unlike humans; feline myocardial infarction is exceedingly rare.',
    },
    {
      id: 'struct-cat-cv-016',
      name: 'Brachiocephalic Trunk',
      latinName: 'Truncus brachiocephalicus',
      svgElementId: 'brachiocephalic-trunk',
      description:
        'The brachiocephalic trunk is the first and largest branch of the aortic arch in cats. It gives rise to the right subclavian artery (supplying the right forelimb) and both common carotid arteries (supplying the head and neck).',
      funFact:
        'In cats, unlike humans, BOTH common carotid arteries typically arise from the brachiocephalic trunk rather than one branching directly from the aortic arch.',
      hint: 'The first large branch off the aortic arch. It is a single trunk that later divides into vessels heading toward the head and the right forelimb.',
      difficultyLevel: 'hard',
      tags: ['artery', 'aortic-arch-branch'],
    },
    {
      id: 'struct-cat-cv-017',
      name: 'Left Subclavian Artery',
      latinName: 'Arteria subclavia sinistra',
      svgElementId: 'left-subclavian-artery',
      description:
        'The left subclavian artery is the second branch of the aortic arch in cats. It supplies oxygenated blood to the left forelimb, and also gives off the vertebral artery that helps supply blood to the brain.',
      funFact:
        'The left subclavian passes over the first rib and becomes the axillary artery — a key pulse point veterinarians use when checking circulation in the forelimb.',
      hint: 'The second branch from the aortic arch, heading toward the left shoulder and forelimb.',
      difficultyLevel: 'hard',
      tags: ['artery', 'aortic-arch-branch'],
    },
    {
      id: 'struct-cat-cv-018',
      name: 'Descending Aorta',
      latinName: 'Aorta descendens',
      svgElementId: 'descending-aorta',
      description:
        'The descending aorta continues from the aortic arch, traveling posteriorly through the thorax (thoracic aorta) and then through the abdomen (abdominal aorta), giving off branches to supply intercostal muscles, abdominal organs, and the hind limbs.',
      funFact:
        'In cats, a dangerous condition called aortic thromboembolism (saddle thrombus) occurs when a blood clot lodges where the descending aorta splits into the iliac arteries, cutting off blood supply to the hind legs.',
      hint: 'Trace the aorta after it arches — this is the long descending segment running along the spine.',
      difficultyLevel: 'medium',
      tags: ['artery', 'great-vessel', 'systemic-circuit'],
      innervation: 'Aortic plexus; sympathetic vasomotor fibers',
      clinicalNote: 'The aortic trifurcation (terminal aorta) is the most common site for saddle thrombus in cats with cardiac disease.',
    },
    {
      id: 'struct-cat-cv-019',
      name: 'Azygos Vein',
      latinName: 'Vena azygos',
      svgElementId: 'azygos-vein',
      description:
        'The azygos vein runs along the right side of the vertebral column in the thorax, collecting blood from the intercostal veins and posterior bronchial veins. It drains into the cranial vena cava near the right atrium.',
      funFact:
        'The name "azygos" means "unpaired" in Greek — unlike most major veins, the azygos has no matching vein on the opposite side of the body.',
      hint: 'A small vein running along the vertebral column in the thorax, parallel to the descending aorta. It empties into the cranial vena cava.',
      difficultyLevel: 'hard',
      tags: ['vein', 'thorax'],
    },
    {
      id: 'struct-cat-cv-020',
      name: 'External Jugular Vein',
      latinName: 'Vena jugularis externa',
      svgElementId: 'external-jugular-vein',
      description:
        'The external jugular vein is a prominent superficial vein on each side of the neck that drains blood from the face and scalp into the brachiocephalic vein or cranial vena cava. It is the vein most commonly used for blood draws in cats.',
      funFact:
        'Veterinary technicians routinely draw blood from the external jugular vein in cats because of its large diameter and superficial location — it is often the easiest vein to access.',
      hint: 'A large superficial vein running along each side of the neck, easily visible when the fur is clipped.',
      difficultyLevel: 'medium',
      tags: ['vein', 'neck', 'clinical'],
      clinicalNote: 'Primary venipuncture site in cats; distension of the external jugular can indicate right-sided heart failure or cranial vena cava obstruction.',
    },
  ];

  for (const s of cardiovascularStructures) {
    await prisma.anatomicalStructure.upsert({
      where: { id: s.id },
      update: {
        svgElementId: s.svgElementId,
        modelId: catCardioModel.id,
        bloodSupply: s.bloodSupply ?? undefined,
        innervation: s.innervation ?? undefined,
        muscleAttachments: s.muscleAttachments ?? undefined,
        clinicalNote: s.clinicalNote ?? undefined,
      },
      create: {
        id: s.id,
        modelId: catCardioModel.id,
        name: s.name,
        latinName: s.latinName,
        svgElementId: s.svgElementId,
        description: s.description,
        funFact: s.funFact,
        hint: s.hint,
        difficultyLevel: s.difficultyLevel,
        tags: s.tags,
        coordinates: undefined,
        bloodSupply: s.bloodSupply ?? undefined,
        innervation: s.innervation ?? undefined,
        muscleAttachments: s.muscleAttachments ?? undefined,
        clinicalNote: s.clinicalNote ?? undefined,
      },
    });
  }
  console.log(`  ✓ ${cardiovascularStructures.length} cardiovascular structures (Cat)`);

  // ─── CAT DIGESTIVE STRUCTURES (2) ──────────────────────────────

  const digestiveStructures: SeedStructure[] = [
    { id: 'struct-cat-dig-001', name: 'Esophagus', latinName: 'Oesophagus', svgElementId: 'esophagus',
      description: 'The esophagus is a muscular tube that carries food from the pharynx to the stomach via peristaltic contractions. It passes through the diaphragm at the esophageal hiatus.',
      funFact: 'A cat\'s esophagus has skeletal muscle in its upper two-thirds, transitioning to smooth muscle — a feature shared with dogs but not with humans.',
      hint: 'A tube running from the throat area, passing through the diaphragm to connect with the top of the stomach.',
      difficultyLevel: 'easy', tags: ['digestive', 'tube'],
      innervation: 'Vagus nerve (CN X); recurrent laryngeal nerve',
      clinicalNote: 'Esophageal strictures can form after foreign body removal or chemical burns in cats.' },
    { id: 'struct-cat-dig-002', name: 'Stomach', latinName: 'Ventriculus (Gaster)', svgElementId: 'stomach',
      description: 'The cat stomach is a J-shaped muscular organ located in the left cranial abdomen. It receives food from the esophagus and mechanically and chemically breaks it down before passing chyme into the duodenum.',
      funFact: 'A cat\'s stomach pH can drop as low as 1 — extremely acidic — which allows them to safely digest raw meat and bone.',
      hint: 'A J-shaped organ in the left upper abdomen, between the esophagus and the small intestine.',
      difficultyLevel: 'easy', tags: ['digestive', 'organ', 'abdomen'],
      bloodSupply: 'Celiac trunk branches: left gastric, right gastric, short gastric arteries',
      innervation: 'Vagus nerve (CN X) parasympathetic; celiac plexus sympathetic',
      clinicalNote: 'Gastric foreign bodies are common in cats; linear foreign bodies (string/thread) are particularly dangerous.' },
    { id: 'struct-cat-dig-003', name: 'Liver', latinName: 'Hepar', svgElementId: 'liver',
      description: 'The cat liver is the largest internal organ, located in the cranial abdomen just caudal to the diaphragm. It has six lobes and performs bile production, detoxification, protein synthesis, and glycogen storage.',
      funFact: 'Cats are uniquely susceptible to hepatic lipidosis — if they stop eating for just 2-3 days, fat can rapidly accumulate in the liver.',
      hint: 'The largest organ in the abdomen, sitting just behind the diaphragm with multiple lobes. Dark reddish-brown.',
      difficultyLevel: 'easy', tags: ['digestive', 'organ', 'abdomen', 'gland'],
      bloodSupply: 'Hepatic artery proper (from celiac trunk); portal vein (nutrient-rich blood from GI tract)',
      innervation: 'Hepatic plexus (sympathetic and vagal parasympathetic fibers)',
      clinicalNote: 'Hepatic lipidosis (fatty liver) is the most common liver disease in cats.' },
    { id: 'struct-cat-dig-004', name: 'Gallbladder', latinName: 'Vesica fellea', svgElementId: 'gallbladder',
      description: 'The gallbladder is a small pear-shaped sac nestled between the right medial and quadrate lobes of the liver. It stores and concentrates bile produced by hepatocytes.',
      funFact: 'Unlike horses and rats, cats do have a gallbladder — and gallstones (cholelithiasis), while uncommon, can occur.',
      hint: 'A small green-tinged sac on the undersurface of the liver, between two of its lobes.',
      difficultyLevel: 'medium', tags: ['digestive', 'gland', 'bile'],
      bloodSupply: 'Cystic artery (branch of hepatic artery)',
      clinicalNote: 'Cholangitis (bile duct inflammation) is more common in cats than cholecystitis; can present with jaundice.' },
    { id: 'struct-cat-dig-005', name: 'Pancreas', latinName: 'Pancreas', svgElementId: 'pancreas',
      description: 'The pancreas is an elongated gland lying in the curve of the duodenum. It has both exocrine (digestive enzymes) and endocrine (insulin, glucagon) functions.',
      funFact: 'The cat pancreas has a unique third lobe — the body — connecting the right and left limbs, giving it a V-shape.',
      hint: 'An elongated pinkish-tan gland tucked into the C-curve of the duodenum.',
      difficultyLevel: 'hard', tags: ['digestive', 'gland'],
      bloodSupply: 'Pancreaticoduodenal arteries (superior and inferior)',
      innervation: 'Vagus nerve (parasympathetic); splanchnic nerves (sympathetic)',
      clinicalNote: 'Feline pancreatitis is often chronic and mild but can cause triaditis (concurrent IBD, cholangitis, and pancreatitis).' },
    { id: 'struct-cat-dig-006', name: 'Spleen', latinName: 'Lien (Splen)', svgElementId: 'spleen',
      description: 'The spleen is an elongated organ on the left side of the abdomen, attached to the greater curvature of the stomach by the gastrosplenic ligament. It filters blood and recycles old red blood cells.',
      funFact: 'The cat spleen can contract under sympathetic stimulation (fight-or-flight), releasing stored red blood cells into circulation.',
      hint: 'An elongated dark red organ on the left side, attached to the stomach.',
      difficultyLevel: 'medium', tags: ['digestive', 'organ', 'abdomen'],
      bloodSupply: 'Splenic artery (branch of celiac trunk)',
      clinicalNote: 'Splenic masses in cats are more likely to be benign (mast cell tumors) compared to dogs where they are often malignant.' },
    { id: 'struct-cat-dig-007', name: 'Duodenum', latinName: 'Duodenum', svgElementId: 'duodenum',
      description: 'The duodenum is the first and shortest segment of the small intestine, forming a C-shaped curve around the pancreas. It receives chyme from the stomach, bile from the gallbladder, and enzymes from the pancreas.',
      funFact: 'The name "duodenum" comes from Latin for "twelve" — referring to its length of approximately twelve finger-widths.',
      hint: 'The C-shaped first segment of the small intestine, wrapping around the pancreas.',
      difficultyLevel: 'medium', tags: ['digestive', 'intestine'],
      bloodSupply: 'Superior and inferior pancreaticoduodenal arteries',
      clinicalNote: 'Duodenal ulcers are less common in cats than dogs but can occur with NSAID use or mast cell tumors.' },
    { id: 'struct-cat-dig-008', name: 'Jejunum', latinName: 'Jejunum', svgElementId: 'jejunum',
      description: 'The jejunum is the longest segment of the small intestine, forming extensive coiled loops in the central abdomen. It is the primary site of nutrient absorption.',
      funFact: 'The word "jejunum" comes from Latin "jejunus" meaning "fasting" — it was historically found empty at dissection.',
      hint: 'The coiled, looping middle segment of the small intestine filling much of the central abdomen.',
      difficultyLevel: 'medium', tags: ['digestive', 'intestine'],
      bloodSupply: 'Jejunal branches of the cranial mesenteric artery',
      clinicalNote: 'Intestinal lymphoma, the most common GI cancer in cats, frequently involves the jejunum.' },
    { id: 'struct-cat-dig-009', name: 'Ileum', latinName: 'Ileum', svgElementId: 'ileum',
      description: 'The ileum is the final segment of the small intestine, connecting to the cecum at the ileocecal junction. It absorbs bile salts and vitamin B12.',
      funFact: 'The ileum has prominent Peyer\'s patches — clusters of lymphoid tissue that serve as the gut\'s immune surveillance system.',
      hint: 'The terminal portion of the small intestine, connecting to the large intestine at the ileocecal junction.',
      difficultyLevel: 'medium', tags: ['digestive', 'intestine'],
      bloodSupply: 'Ileal branches of the cranial mesenteric artery',
      clinicalNote: 'The ileocecal junction is a common site for intestinal foreign body obstruction in cats.' },
    { id: 'struct-cat-dig-010', name: 'Cecum', latinName: 'Caecum', svgElementId: 'cecum',
      description: 'The cecum is a small blind-ended pouch at the junction of the ileum and colon. In cats, it is small and comma-shaped, unlike the large cecum of herbivores.',
      funFact: 'The feline cecum is tiny compared to herbivores because cats, as obligate carnivores, have minimal need for cellulose fermentation.',
      hint: 'A small pouch at the junction where the small intestine meets the large intestine.',
      difficultyLevel: 'medium', tags: ['digestive', 'intestine'],
      bloodSupply: 'Ileocolic artery (branch of cranial mesenteric artery)',
      clinicalNote: 'Cecal inversion (intussusception into the colon) is a rare but documented condition in cats.' },
    { id: 'struct-cat-dig-011', name: 'Colon', latinName: 'Colon', svgElementId: 'colon',
      description: 'The colon is the main portion of the large intestine, divided into ascending, transverse, and descending segments. It absorbs water and electrolytes, forming feces.',
      funFact: 'The cat colon is relatively short compared to herbivores, reflecting their high-protein, low-fiber carnivorous diet.',
      hint: 'The frame-like large intestine with ascending, transverse, and descending segments bordering the abdominal cavity.',
      difficultyLevel: 'medium', tags: ['digestive', 'intestine'],
      bloodSupply: 'Cranial and caudal mesenteric arteries',
      innervation: 'Pelvic nerve (parasympathetic); hypogastric nerve (sympathetic)',
      clinicalNote: 'Megacolon is a common condition in cats where the colon becomes chronically dilated and loses motility.' },
    { id: 'struct-cat-dig-012', name: 'Rectum', latinName: 'Rectum', svgElementId: 'rectum',
      description: 'The rectum is the terminal segment of the large intestine, connecting the descending colon to the anus. It stores feces before defecation.',
      funFact: 'Cats have a highly sensitive rectum — even mild distension triggers the defecation reflex, contributing to their fastidious litter box habits.',
      hint: 'The final straight portion of the intestinal tract, leading to the anus at the caudal end.',
      difficultyLevel: 'easy', tags: ['digestive', 'intestine'],
      clinicalNote: 'Rectal prolapse can occur in cats with chronic straining from constipation or diarrhea.' },
    { id: 'struct-cat-dig-013', name: 'Greater Omentum', latinName: 'Omentum majus', svgElementId: 'greater-omentum',
      description: 'The greater omentum is a large, apron-like fold of peritoneum that hangs from the greater curvature of the stomach and drapes over the intestines. It stores fat and provides immune surveillance.',
      funFact: 'The omentum is sometimes called the "abdominal policeman" because it migrates to sites of inflammation or injury to wall off infections.',
      hint: 'A large fatty drape of tissue hanging from the stomach, covering the intestines like an apron.',
      difficultyLevel: 'hard', tags: ['digestive', 'peritoneum'],
      bloodSupply: 'Right and left gastroepiploic arteries',
      clinicalNote: 'Omental adhesions can form after abdominal surgery; the omentum is intentionally used to wrap surgical sites for healing support.' },
    { id: 'struct-cat-dig-014', name: 'Mesentery', latinName: 'Mesenterium', svgElementId: 'mesentery',
      description: 'The mesentery is a fan-shaped double fold of peritoneum that suspends the small intestine from the dorsal body wall. It carries blood vessels, lymphatics, and nerves to the gut.',
      funFact: 'The mesentery was reclassified as a single continuous organ in 2017, after centuries of being considered fragmented tissue.',
      hint: 'A fan-shaped fold of tissue connecting the intestinal loops to the back wall of the abdomen.',
      difficultyLevel: 'hard', tags: ['digestive', 'peritoneum'],
      bloodSupply: 'Cranial mesenteric artery and its branches',
      clinicalNote: 'Mesenteric lymph nodes are key diagnostic sites — enlarged nodes may indicate lymphoma or inflammatory bowel disease.' },
    { id: 'struct-cat-dig-015', name: 'Pyloric Sphincter', latinName: 'Sphincter pylori', svgElementId: 'pyloric-sphincter',
      description: 'The pyloric sphincter is a thick ring of smooth muscle at the junction of the stomach and duodenum. It controls the rate of gastric emptying by regulating chyme passage.',
      funFact: 'The pyloric sphincter can sense the acidity and fat content of chyme, slowing emptying when the duodenum needs more time to process.',
      hint: 'A muscular ring at the exit of the stomach where it connects to the duodenum.',
      difficultyLevel: 'hard', tags: ['digestive', 'sphincter'],
      muscleAttachments: 'Circular smooth muscle layer thickened into a ring; longitudinal muscle layer continuous with gastric and duodenal walls',
      clinicalNote: 'Pyloric stenosis (thickening) can cause chronic vomiting in cats; diagnosed by ultrasound and may require pyloroplasty.' },
  ];

  // ─── Generic structure seeder ──────────────────────────────────
  async function seedStructures(structures: SeedStructure[], modelId: string) {
    for (const s of structures) {
      await prisma.anatomicalStructure.upsert({
        where: { id: s.id },
        update: {
          svgElementId: s.svgElementId,
          modelId,
          bloodSupply: s.bloodSupply ?? undefined,
          innervation: s.innervation ?? undefined,
          muscleAttachments: s.muscleAttachments ?? undefined,
          clinicalNote: s.clinicalNote ?? undefined,
        },
        create: {
          id: s.id,
          modelId,
          name: s.name,
          latinName: s.latinName,
          svgElementId: s.svgElementId,
          description: s.description,
          funFact: s.funFact,
          hint: s.hint,
          difficultyLevel: s.difficultyLevel,
          tags: s.tags,
          coordinates: undefined,
          bloodSupply: s.bloodSupply ?? undefined,
          innervation: s.innervation ?? undefined,
          muscleAttachments: s.muscleAttachments ?? undefined,
          clinicalNote: s.clinicalNote ?? undefined,
        },
      });
    }
  }

  await seedStructures(digestiveStructures, catDigestiveModel.id);
  console.log(`  ✓ ${digestiveStructures.length} digestive structures (Cat)`);

  // ─── RAT CARDIOVASCULAR STRUCTURES (14) ────────────────────────

  const ratCvStructures: SeedStructure[] = [
    { id: 'struct-rat-cv-001', name: 'Left Ventricle', latinName: 'Ventriculus sinister', svgElementId: 'left-ventricle',
      description: 'The left ventricle is the thickest-walled chamber of the rat heart, pumping oxygenated blood through the aorta to the body.',
      funFact: 'A rat\'s heart beats 300-500 times per minute at rest — roughly 3-4x faster than a cat\'s.', hint: 'The thick-walled chamber on the left side of the heart, closest to the apex.',
      difficultyLevel: 'easy', tags: ['heart', 'chamber', 'systemic-circuit'],
      bloodSupply: 'Left coronary artery', innervation: 'Vagus nerve (CN X); sympathetic cardiac nerves',
      clinicalNote: 'Left ventricular hypertrophy in rats is a common model for studying human hypertensive heart disease.' },
    { id: 'struct-rat-cv-002', name: 'Right Ventricle', latinName: 'Ventriculus dexter', svgElementId: 'right-ventricle',
      description: 'The right ventricle pumps deoxygenated blood to the lungs via the pulmonary arteries. Its wall is thinner than the left ventricle.',
      funFact: null, hint: 'The thinner-walled chamber on the right side of the heart, wrapping around the left ventricle.',
      difficultyLevel: 'easy', tags: ['heart', 'chamber', 'pulmonary-circuit'],
      bloodSupply: 'Right coronary artery', innervation: 'Vagus nerve; sympathetic cardiac nerves' },
    { id: 'struct-rat-cv-003', name: 'Left Atrium', latinName: 'Atrium sinistrum', svgElementId: 'left-atrium',
      description: 'The left atrium receives oxygenated blood from the pulmonary veins and passes it to the left ventricle through the mitral valve.',
      funFact: null, hint: 'The upper-left chamber receiving blood from the lungs.',
      difficultyLevel: 'easy', tags: ['heart', 'chamber', 'pulmonary-circuit'],
      bloodSupply: 'Left circumflex coronary artery' },
    { id: 'struct-rat-cv-004', name: 'Right Atrium', latinName: 'Atrium dextrum', svgElementId: 'right-atrium',
      description: 'The right atrium receives deoxygenated blood from the body via the superior and inferior vena cava.',
      funFact: 'The rat right atrium is proportionally larger relative to body size than in cats, accommodating its rapid heart rate.',
      hint: 'The upper-right chamber connecting to the vena cavae.',
      difficultyLevel: 'easy', tags: ['heart', 'chamber', 'systemic-circuit'],
      bloodSupply: 'Right coronary artery (SA nodal branch)' },
    { id: 'struct-rat-cv-005', name: 'Aorta', latinName: 'Aorta', svgElementId: 'aorta',
      description: 'The aorta is the largest artery, arising from the left ventricle and distributing oxygenated blood throughout the body.',
      funFact: 'The rat aorta is approximately 2mm in diameter — about the width of a pencil lead.',
      hint: 'The large artery exiting the top of the heart, arching before descending.',
      difficultyLevel: 'medium', tags: ['artery', 'great-vessel', 'systemic-circuit'],
      innervation: 'Sympathetic fibers from aortic plexus',
      clinicalNote: 'The rat aorta is widely used in pharmacological research for studying vascular tone and drug responses.' },
    { id: 'struct-rat-cv-006', name: 'Pulmonary Trunk', latinName: 'Truncus pulmonalis', svgElementId: 'pulmonary-trunk',
      description: 'The pulmonary trunk exits the right ventricle and bifurcates into left and right pulmonary arteries carrying deoxygenated blood to the lungs.',
      funFact: null, hint: 'The large vessel leaving the right ventricle, splitting toward both lungs.',
      difficultyLevel: 'medium', tags: ['artery', 'great-vessel', 'pulmonary-circuit'] },
    { id: 'struct-rat-cv-007', name: 'Superior Vena Cava', latinName: 'Vena cava cranialis', svgElementId: 'superior-vena-cava',
      description: 'The superior vena cava returns deoxygenated blood from the head, neck, and forelimbs to the right atrium.',
      funFact: 'Rats, like cats, have bilateral cranial venae cavae — a left and right — unlike humans who typically have only one.',
      hint: 'The large vein entering the right atrium from above.',
      difficultyLevel: 'medium', tags: ['vein', 'great-vessel', 'systemic-circuit'] },
    { id: 'struct-rat-cv-008', name: 'Inferior Vena Cava', latinName: 'Vena cava caudalis', svgElementId: 'inferior-vena-cava',
      description: 'The inferior vena cava returns deoxygenated blood from the abdomen, pelvis, and hind limbs to the right atrium.',
      funFact: null, hint: 'The large vein entering the right atrium from below, passing through the diaphragm.',
      difficultyLevel: 'medium', tags: ['vein', 'great-vessel', 'systemic-circuit'] },
    { id: 'struct-rat-cv-009', name: 'Pulmonary Veins', latinName: 'Venae pulmonales', svgElementId: 'pulmonary-veins',
      description: 'The pulmonary veins return oxygenated blood from the lungs to the left atrium. They are the only veins carrying oxygenated blood.',
      funFact: null, hint: 'Vessels entering the left atrium from the lungs, on the posterior side of the heart.',
      difficultyLevel: 'medium', tags: ['vein', 'pulmonary-circuit'] },
    { id: 'struct-rat-cv-010', name: 'Mitral Valve', latinName: 'Valva mitralis', svgElementId: 'mitral-valve',
      description: 'The mitral (bicuspid) valve sits between the left atrium and left ventricle, preventing backflow during systole.',
      funFact: null, hint: 'The two-cusped valve between the left atrium and left ventricle.',
      difficultyLevel: 'hard', tags: ['heart', 'valve'] },
    { id: 'struct-rat-cv-011', name: 'Tricuspid Valve', latinName: 'Valva tricuspidalis', svgElementId: 'tricuspid-valve',
      description: 'The tricuspid valve has three cusps and sits between the right atrium and right ventricle.',
      funFact: null, hint: 'The three-cusped valve between the right atrium and right ventricle.',
      difficultyLevel: 'hard', tags: ['heart', 'valve'] },
    { id: 'struct-rat-cv-012', name: 'Interventricular Septum', latinName: 'Septum interventriculare', svgElementId: 'interventricular-septum',
      description: 'The muscular wall dividing the left and right ventricles, preventing mixing of oxygenated and deoxygenated blood.',
      funFact: null, hint: 'The thick muscular partition between the two lower heart chambers.',
      difficultyLevel: 'medium', tags: ['heart', 'septum'] },
    { id: 'struct-rat-cv-013', name: 'Coronary Arteries', latinName: 'Arteriae coronariae', svgElementId: 'coronary-arteries',
      description: 'The coronary arteries supply oxygenated blood to the heart muscle itself, branching from the base of the aorta.',
      funFact: 'Rats are resistant to coronary atherosclerosis, making them useful models for studying healthy coronary physiology.',
      hint: 'Small arteries on the surface of the heart, branching from the aorta.',
      difficultyLevel: 'hard', tags: ['artery', 'heart', 'myocardium'],
      clinicalNote: 'Coronary ligation in rats is a standard experimental model for studying myocardial infarction and heart failure.' },
    { id: 'struct-rat-cv-014', name: 'Descending Aorta', latinName: 'Aorta descendens', svgElementId: 'descending-aorta',
      description: 'The descending aorta continues from the aortic arch through the thorax and abdomen, supplying the body.',
      funFact: null, hint: 'The long descending segment of the aorta running along the spine.',
      difficultyLevel: 'medium', tags: ['artery', 'great-vessel', 'systemic-circuit'] },
  ];

  await seedStructures(ratCvStructures, ratCardioModel.id);
  console.log(`  ✓ ${ratCvStructures.length} cardiovascular structures (Rat)`);

  // ─── FETAL PIG CARDIOVASCULAR STRUCTURES (18) ──────────────────

  const pigCvStructures: SeedStructure[] = [
    { id: 'struct-pig-cv-001', name: 'Left Ventricle', latinName: 'Ventriculus sinister', svgElementId: 'left-ventricle',
      description: 'The left ventricle of the fetal pig pumps oxygenated blood from the placenta through the aorta to the body.',
      funFact: 'In the fetus, the left ventricle receives most of its blood via the foramen ovale bypass rather than from the lungs.',
      hint: 'The thick-walled chamber on the left side of the heart.',
      difficultyLevel: 'easy', tags: ['heart', 'chamber', 'systemic-circuit'],
      bloodSupply: 'Left coronary artery', clinicalNote: 'The fetal pig heart closely resembles the human fetal heart, making it an excellent teaching model.' },
    { id: 'struct-pig-cv-002', name: 'Right Ventricle', latinName: 'Ventriculus dexter', svgElementId: 'right-ventricle',
      description: 'The right ventricle pumps blood into the pulmonary trunk. In the fetus, most of this blood bypasses the lungs via the ductus arteriosus.',
      funFact: 'In the fetus, the right ventricle actually does MORE work than the left because it pumps against both pulmonary and systemic resistance via the ductus.',
      hint: 'The thinner-walled chamber on the right side of the heart.',
      difficultyLevel: 'easy', tags: ['heart', 'chamber', 'pulmonary-circuit'] },
    { id: 'struct-pig-cv-003', name: 'Left Atrium', latinName: 'Atrium sinistrum', svgElementId: 'left-atrium',
      description: 'The left atrium receives blood from the pulmonary veins and also from the right atrium via the foramen ovale in the fetus.',
      funFact: null, hint: 'The upper-left chamber. In the fetus, it receives blood from both the lungs and the foramen ovale.',
      difficultyLevel: 'easy', tags: ['heart', 'chamber', 'pulmonary-circuit'] },
    { id: 'struct-pig-cv-004', name: 'Right Atrium', latinName: 'Atrium dextrum', svgElementId: 'right-atrium',
      description: 'The right atrium receives deoxygenated blood from the body and oxygenated blood from the umbilical vein (via the ductus venosus and IVC).',
      funFact: null, hint: 'The upper-right chamber receiving blood from the vena cavae.',
      difficultyLevel: 'easy', tags: ['heart', 'chamber', 'systemic-circuit'] },
    { id: 'struct-pig-cv-005', name: 'Aorta', latinName: 'Aorta', svgElementId: 'aorta',
      description: 'The aorta arises from the left ventricle and distributes oxygenated blood to the body. It also receives blood from the ductus arteriosus.',
      funFact: null, hint: 'The large artery exiting the heart, arching before descending.',
      difficultyLevel: 'medium', tags: ['artery', 'great-vessel', 'systemic-circuit'] },
    { id: 'struct-pig-cv-006', name: 'Pulmonary Trunk', latinName: 'Truncus pulmonalis', svgElementId: 'pulmonary-trunk',
      description: 'The pulmonary trunk exits the right ventricle. In the fetus, most blood bypasses the non-functional lungs via the ductus arteriosus.',
      funFact: null, hint: 'The vessel leaving the right ventricle, connecting to the ductus arteriosus in the fetus.',
      difficultyLevel: 'medium', tags: ['artery', 'great-vessel', 'pulmonary-circuit'] },
    { id: 'struct-pig-cv-007', name: 'Superior Vena Cava', latinName: 'Vena cava cranialis', svgElementId: 'superior-vena-cava',
      description: 'Returns deoxygenated blood from the head, neck, and forelimbs to the right atrium.',
      funFact: null, hint: 'The large vein entering the right atrium from above.',
      difficultyLevel: 'medium', tags: ['vein', 'great-vessel', 'systemic-circuit'] },
    { id: 'struct-pig-cv-008', name: 'Inferior Vena Cava', latinName: 'Vena cava caudalis', svgElementId: 'inferior-vena-cava',
      description: 'Returns blood from the lower body to the right atrium. In the fetus, it carries a mix of oxygenated (from umbilical vein) and deoxygenated blood.',
      funFact: null, hint: 'The large vein entering the right atrium from below.',
      difficultyLevel: 'medium', tags: ['vein', 'great-vessel', 'systemic-circuit'] },
    { id: 'struct-pig-cv-009', name: 'Pulmonary Veins', latinName: 'Venae pulmonales', svgElementId: 'pulmonary-veins',
      description: 'Return blood from the lungs to the left atrium. In the fetus, they carry very little blood since the lungs are not yet functional.',
      funFact: null, hint: 'Vessels entering the left atrium from the lungs.',
      difficultyLevel: 'medium', tags: ['vein', 'pulmonary-circuit'] },
    { id: 'struct-pig-cv-010', name: 'Mitral Valve', latinName: 'Valva mitralis', svgElementId: 'mitral-valve',
      description: 'The bicuspid valve between the left atrium and left ventricle.',
      funFact: null, hint: 'The two-cusped valve on the left side of the heart.',
      difficultyLevel: 'hard', tags: ['heart', 'valve'] },
    { id: 'struct-pig-cv-011', name: 'Tricuspid Valve', latinName: 'Valva tricuspidalis', svgElementId: 'tricuspid-valve',
      description: 'The three-cusped valve between the right atrium and right ventricle.',
      funFact: null, hint: 'The three-cusped valve on the right side of the heart.',
      difficultyLevel: 'hard', tags: ['heart', 'valve'] },
    { id: 'struct-pig-cv-012', name: 'Interventricular Septum', latinName: 'Septum interventriculare', svgElementId: 'interventricular-septum',
      description: 'The muscular wall dividing the ventricles.',
      funFact: null, hint: 'The thick partition between the two lower chambers.',
      difficultyLevel: 'medium', tags: ['heart', 'septum'] },
    { id: 'struct-pig-cv-013', name: 'Coronary Arteries', latinName: 'Arteriae coronariae', svgElementId: 'coronary-arteries',
      description: 'Supply blood to the heart muscle, branching from the base of the aorta.',
      funFact: null, hint: 'Small arteries on the heart surface, originating from the aorta.',
      difficultyLevel: 'hard', tags: ['artery', 'heart', 'myocardium'] },
    { id: 'struct-pig-cv-014', name: 'Descending Aorta', latinName: 'Aorta descendens', svgElementId: 'descending-aorta',
      description: 'Continues from the aortic arch through the thorax and abdomen. In the fetus, it gives rise to the umbilical arteries.',
      funFact: null, hint: 'The descending segment of the aorta running along the spine.',
      difficultyLevel: 'medium', tags: ['artery', 'great-vessel', 'systemic-circuit'] },
    { id: 'struct-pig-cv-015', name: 'Ductus Arteriosus', latinName: 'Ductus arteriosus', svgElementId: 'ductus-arteriosus',
      description: 'A short vessel connecting the pulmonary trunk to the aorta, allowing blood to bypass the non-functional fetal lungs. It closes within hours of birth to become the ligamentum arteriosum.',
      funFact: 'The ductus arteriosus closes in response to rising oxygen levels at birth — one of the most dramatic physiological transitions in mammalian life.',
      hint: 'A short connecting vessel between the pulmonary trunk and the aorta. Unique to fetal circulation.',
      difficultyLevel: 'hard', tags: ['artery', 'fetal-shunt'],
      clinicalNote: 'Patent ductus arteriosus (PDA) occurs when this vessel fails to close after birth, causing a continuous heart murmur.' },
    { id: 'struct-pig-cv-016', name: 'Foramen Ovale', latinName: 'Foramen ovale', svgElementId: 'foramen-ovale',
      description: 'An opening in the interatrial septum that allows blood to flow from the right atrium directly to the left atrium, bypassing the fetal lungs. It closes at birth to become the fossa ovalis.',
      funFact: 'About 25% of humans retain a small patent foramen ovale (PFO) into adulthood — usually harmless but occasionally linked to stroke.',
      hint: 'An opening in the wall between the two atria. Only present in the fetus.',
      difficultyLevel: 'hard', tags: ['heart', 'fetal-shunt'],
      clinicalNote: 'Patent foramen ovale can cause right-to-left shunting and paradoxical embolism if it fails to close.' },
    { id: 'struct-pig-cv-017', name: 'Umbilical Arteries', latinName: 'Arteriae umbilicales', svgElementId: 'umbilical-arteries',
      description: 'Paired arteries branching from the internal iliac arteries that carry deoxygenated blood from the fetus to the placenta for gas exchange.',
      funFact: 'After birth, the umbilical arteries become the medial umbilical ligaments — fibrous cords on the inner abdominal wall.',
      hint: 'Paired arteries running from the lower aorta/iliac arteries toward the umbilicus.',
      difficultyLevel: 'medium', tags: ['artery', 'fetal-shunt', 'umbilical'] },
    { id: 'struct-pig-cv-018', name: 'Umbilical Vein', latinName: 'Vena umbilicalis', svgElementId: 'umbilical-vein',
      description: 'A single vein that carries oxygenated blood from the placenta to the fetus. It enters through the umbilicus and connects to the liver and IVC via the ductus venosus.',
      funFact: 'The umbilical vein carries the most highly oxygenated blood in the entire fetal body — it is the fetal equivalent of the pulmonary veins.',
      hint: 'A single large vein running from the umbilicus toward the liver. Carries oxygenated blood.',
      difficultyLevel: 'medium', tags: ['vein', 'fetal-shunt', 'umbilical'],
      clinicalNote: 'The umbilical vein becomes the round ligament of the liver (ligamentum teres hepatis) after birth.' },
  ];

  await seedStructures(pigCvStructures, pigCardioModel.id);
  console.log(`  ✓ ${pigCvStructures.length} cardiovascular structures (Fetal Pig)`);

  // ─── FROG CARDIOVASCULAR STRUCTURES (12) ───────────────────────

  const frogCvStructures: SeedStructure[] = [
    { id: 'struct-frog-cv-001', name: 'Ventricle', latinName: 'Ventriculus', svgElementId: 'ventricle',
      description: 'The frog has a single muscular ventricle that receives blood from both atria. While often described as mixing blood, internal trabeculae and contraction timing partially separate oxygenated and deoxygenated streams.',
      funFact: 'Despite having a single ventricle, frogs achieve surprisingly efficient oxygen delivery — the spiral valve in the conus arteriosus helps direct blood to the right destinations.',
      hint: 'The single large thick-walled chamber at the bottom of the heart.',
      difficultyLevel: 'easy', tags: ['heart', 'chamber'],
      clinicalNote: 'The single ventricle demonstrates that complete separation of blood streams is not required for effective circulation in ectotherms.' },
    { id: 'struct-frog-cv-002', name: 'Left Atrium', latinName: 'Atrium sinistrum', svgElementId: 'left-atrium',
      description: 'The left atrium receives oxygenated blood from the lungs via the pulmonary veins and passes it to the ventricle.',
      funFact: null, hint: 'The upper-left chamber receiving oxygenated blood from the lungs.',
      difficultyLevel: 'easy', tags: ['heart', 'chamber'] },
    { id: 'struct-frog-cv-003', name: 'Right Atrium', latinName: 'Atrium dextrum', svgElementId: 'right-atrium',
      description: 'The right atrium is larger than the left and receives deoxygenated blood from the body via the sinus venosus.',
      funFact: 'The frog right atrium is notably larger than the left because it receives all systemic venous return plus blood from cutaneous respiration.',
      hint: 'The larger upper-right chamber receiving blood from the sinus venosus.',
      difficultyLevel: 'easy', tags: ['heart', 'chamber'] },
    { id: 'struct-frog-cv-004', name: 'Sinus Venosus', latinName: 'Sinus venosus', svgElementId: 'sinus-venosus',
      description: 'The sinus venosus is a thin-walled sac posterior to the right atrium that collects all systemic venous blood before it enters the right atrium. It is the pacemaker of the frog heart.',
      funFact: 'The sinus venosus is the most primitive heart chamber — in mammals, it has been absorbed into the wall of the right atrium as the sinoatrial node.',
      hint: 'A thin-walled sac on the dorsal side of the heart, collecting venous blood.',
      difficultyLevel: 'medium', tags: ['heart', 'chamber'],
      clinicalNote: 'The sinus venosus pacemaker cells are homologous to the mammalian SA node — a key concept in comparative cardiac physiology.' },
    { id: 'struct-frog-cv-005', name: 'Conus Arteriosus', latinName: 'Conus arteriosus', svgElementId: 'conus-arteriosus',
      description: 'The conus arteriosus is a muscular outflow tract from the ventricle containing a spiral valve that helps direct oxygenated and deoxygenated blood to different arterial arches.',
      funFact: 'The spiral valve in the conus acts like a traffic divider — directing deoxygenated blood toward the lungs and oxygenated blood toward the body, despite both coming from a single ventricle.',
      hint: 'The muscular tube exiting the ventricle, containing an internal spiral valve.',
      difficultyLevel: 'hard', tags: ['heart', 'outflow'] },
    { id: 'struct-frog-cv-006', name: 'Truncus Arteriosus', latinName: 'Truncus arteriosus', svgElementId: 'truncus-arteriosus',
      description: 'The truncus arteriosus is the main arterial trunk that receives blood from the conus and divides into three pairs of arterial arches on each side.',
      funFact: 'In mammalian embryos, the truncus arteriosus splits into the aorta and pulmonary trunk — in frogs, it persists as a single trunk throughout life.',
      hint: 'The main trunk that splits into three pairs of arches heading to the head, body, and lungs.',
      difficultyLevel: 'hard', tags: ['artery', 'great-vessel'] },
    { id: 'struct-frog-cv-007', name: 'Carotid Arches', latinName: 'Arcus caroticus', svgElementId: 'carotid-arches',
      description: 'The carotid arches (arch III) are the most anterior pair of arterial arches, supplying oxygenated blood to the head and brain.',
      funFact: null, hint: 'The pair of arteries from the truncus that supply the head, branching anteriorly.',
      difficultyLevel: 'medium', tags: ['artery', 'arch'] },
    { id: 'struct-frog-cv-008', name: 'Systemic Arches', latinName: 'Arcus aortae (systemicus)', svgElementId: 'systemic-arches',
      description: 'The systemic arches (arch IV) are the middle pair, curving posteriorly to unite as the dorsal aorta and supplying the body.',
      funFact: 'The systemic arches are homologous to the aortic arch in mammals — in frogs, both left and right persist (in mammals only one side survives).',
      hint: 'The pair of arteries curving backward to form the dorsal aorta, supplying the body.',
      difficultyLevel: 'medium', tags: ['artery', 'arch', 'systemic-circuit'] },
    { id: 'struct-frog-cv-009', name: 'Pulmocutaneous Arches', latinName: 'Arcus pulmocutaneus', svgElementId: 'pulmocutaneous-arches',
      description: 'The pulmocutaneous arches (arch VI) are the most posterior pair, carrying primarily deoxygenated blood to the lungs and skin for gas exchange.',
      funFact: 'The pulmocutaneous arch is unique to amphibians — it supplies both the lungs AND the skin, reflecting the frog\'s dual respiratory strategy.',
      hint: 'The posterior pair of arches heading to the lungs and skin.',
      difficultyLevel: 'hard', tags: ['artery', 'arch', 'pulmonary-circuit'],
      clinicalNote: 'The pulmocutaneous arch demonstrates the amphibian adaptation of using skin as a supplementary respiratory organ.' },
    { id: 'struct-frog-cv-010', name: 'Posterior Vena Cava', latinName: 'Vena cava posterior', svgElementId: 'posterior-vena-cava',
      description: 'The posterior vena cava is the large vein returning deoxygenated blood from the body to the sinus venosus.',
      funFact: null, hint: 'The large vein returning blood from the body to the sinus venosus.',
      difficultyLevel: 'medium', tags: ['vein', 'systemic-circuit'] },
    { id: 'struct-frog-cv-011', name: 'Pulmonary Veins', latinName: 'Venae pulmonales', svgElementId: 'pulmonary-veins',
      description: 'The pulmonary veins return oxygenated blood from the lungs to the left atrium.',
      funFact: null, hint: 'Veins entering the left atrium from the lungs.',
      difficultyLevel: 'medium', tags: ['vein', 'pulmonary-circuit'] },
    { id: 'struct-frog-cv-012', name: 'Cutaneous Artery', latinName: 'Arteria cutanea', svgElementId: 'cutaneous-artery',
      description: 'The cutaneous artery branches from the pulmocutaneous arch and supplies the skin, where gas exchange occurs through the moist, highly vascularized skin surface.',
      funFact: 'Frogs can absorb up to 100% of their oxygen through their skin during hibernation when their lungs are inactive.',
      hint: 'An artery branching toward the skin from the pulmocutaneous arch.',
      difficultyLevel: 'hard', tags: ['artery', 'cutaneous'],
      clinicalNote: 'Cutaneous respiration in frogs makes them highly sensitive to environmental pollutants, serving as bioindicators of ecosystem health.' },
  ];

  await seedStructures(frogCvStructures, frogCardioModel.id);
  console.log(`  ✓ ${frogCvStructures.length} cardiovascular structures (Frog)`);

  // ─── EARTHWORM CARDIOVASCULAR STRUCTURES (10) ──────────────────

  const wormCvStructures: SeedStructure[] = [
    { id: 'struct-worm-cv-001', name: 'Dorsal Blood Vessel', latinName: 'Vas dorsale', svgElementId: 'dorsal-vessel',
      description: 'The dorsal blood vessel runs along the top of the body, contracting rhythmically to propel blood anteriorly. It is the main pumping vessel of the earthworm.',
      funFact: 'The dorsal vessel is the earthworm\'s functional heart — it contracts in peristaltic waves from posterior to anterior.',
      hint: 'The main vessel running along the top of the worm, pumping blood forward.',
      difficultyLevel: 'easy', tags: ['vessel', 'dorsal'],
      clinicalNote: 'The earthworm closed circulatory system is the simplest example students encounter and introduces the concept of circulatory pressure.' },
    { id: 'struct-worm-cv-002', name: 'Ventral Blood Vessel', latinName: 'Vas ventrale', svgElementId: 'ventral-vessel',
      description: 'The ventral blood vessel runs along the underside of the body, carrying blood posteriorly to distribute to body tissues via segmental branches.',
      funFact: null, hint: 'The main vessel running along the bottom of the worm, carrying blood backward.',
      difficultyLevel: 'easy', tags: ['vessel', 'ventral'] },
    { id: 'struct-worm-cv-003', name: 'Aortic Arches', latinName: 'Arcus aortici (corda)', svgElementId: 'aortic-arches',
      description: 'Five pairs of muscular loops (in segments 7-11) connecting the dorsal and ventral vessels. They contract rhythmically and are often called the earthworm\'s "hearts."',
      funFact: 'Earthworms have 5 pairs of aortic arches — 10 "hearts" — but they are really just thickened, contractile blood vessels rather than true hearts.',
      hint: 'Five paired loops connecting the dorsal and ventral vessels in the anterior body.',
      difficultyLevel: 'medium', tags: ['vessel', 'arch', 'heart'] },
    { id: 'struct-worm-cv-004', name: 'Subneural Vessel', latinName: 'Vas subneurale', svgElementId: 'subneural-vessel',
      description: 'A thin blood vessel running beneath the ventral nerve cord, supplying the nervous system with nutrients and oxygen.',
      funFact: null, hint: 'A thin vessel beneath the nerve cord on the ventral side.',
      difficultyLevel: 'hard', tags: ['vessel', 'ventral'] },
    { id: 'struct-worm-cv-005', name: 'Ventral Nerve Cord', latinName: 'Chorda nervosa ventralis', svgElementId: 'ventral-nerve-cord',
      description: 'The ventral nerve cord runs the length of the body with segmental ganglia (nerve cell clusters) in each segment, coordinating movement and responses.',
      funFact: 'Each segment\'s ganglion can independently control local reflexes — an earthworm cut in half can still move both pieces.',
      hint: 'A cord running along the ventral side with bead-like swellings (ganglia) in each segment.',
      difficultyLevel: 'medium', tags: ['nervous', 'ventral'] },
    { id: 'struct-worm-cv-006', name: 'Cerebral Ganglia', latinName: 'Ganglia cerebralia', svgElementId: 'cerebral-ganglia',
      description: 'The cerebral ganglia (brain) are a pair of nerve cell clusters in the head region, connected to the ventral nerve cord by circumesophageal connectives.',
      funFact: 'The earthworm "brain" contains only about 302 neurons — roughly the same as the well-studied nematode C. elegans.',
      hint: 'A pair of nerve clusters at the anterior (head) end of the worm.',
      difficultyLevel: 'medium', tags: ['nervous', 'anterior'] },
    { id: 'struct-worm-cv-007', name: 'Segmental Vessels', latinName: 'Vasa segmentalia', svgElementId: 'segmental-vessels',
      description: 'Small lateral branches that connect the dorsal and ventral vessels in each body segment, distributing blood to the body wall, intestine, and nephridia.',
      funFact: null, hint: 'Small lateral branches connecting dorsal and ventral vessels in each segment.',
      difficultyLevel: 'hard', tags: ['vessel', 'segmental'] },
    { id: 'struct-worm-cv-008', name: 'Pharynx', latinName: 'Pharynx', svgElementId: 'pharynx',
      description: 'The pharynx is a muscular pumping organ in the anterior segments that sucks soil and organic matter into the digestive tract.',
      funFact: 'The pharynx acts like a suction pump — its muscular walls contract to create negative pressure that pulls food in.',
      hint: 'A muscular bulge in the anterior digestive tract, used for feeding.',
      difficultyLevel: 'easy', tags: ['digestive', 'anterior'] },
    { id: 'struct-worm-cv-009', name: 'Crop', latinName: 'Ingluvies', svgElementId: 'crop',
      description: 'The crop is a thin-walled storage organ where food is held temporarily before passing to the gizzard for mechanical processing.',
      funFact: null, hint: 'A soft, expandable storage area in the digestive tube, just before the gizzard.',
      difficultyLevel: 'easy', tags: ['digestive'] },
    { id: 'struct-worm-cv-010', name: 'Gizzard', latinName: 'Ventriculus (Gigerium)', svgElementId: 'gizzard',
      description: 'The gizzard is a thick-walled, muscular organ that uses ingested sand grains to mechanically grind food, compensating for the earthworm\'s lack of teeth.',
      funFact: 'The gizzard works like a biological rock tumbler — sand and grit particles inside act as grinding stones to break down food.',
      hint: 'A thick, muscular grinding organ just posterior to the crop.',
      difficultyLevel: 'medium', tags: ['digestive'],
      muscleAttachments: 'Thick circular muscle layer with strong contractions for mechanical grinding' },
  ];

  await seedStructures(wormCvStructures, wormCardioModel.id);
  console.log(`  ✓ ${wormCvStructures.length} cardiovascular structures (Earthworm)`);

  // ─── GRASSHOPPER CARDIOVASCULAR STRUCTURES (10) ────────────────

  const grasshopperCvStructures: SeedStructure[] = [
    { id: 'struct-grasshopper-cv-001', name: 'Dorsal Heart', latinName: 'Cor dorsale', svgElementId: 'dorsal-heart',
      description: 'The grasshopper heart is a tubular organ running along the dorsal surface of the abdomen. It contracts in waves to pump hemolymph anteriorly through the open circulatory system.',
      funFact: 'The insect heart beats only 30-60 times per minute — much slower than most vertebrate hearts — because the open circulatory system operates at very low pressure.',
      hint: 'A tubular organ along the top of the abdomen.',
      difficultyLevel: 'easy', tags: ['heart', 'dorsal'],
      clinicalNote: 'The insect open circulatory system demonstrates that high-pressure closed circuits are not required for small-bodied organisms.' },
    { id: 'struct-grasshopper-cv-002', name: 'Dorsal Aorta', latinName: 'Aorta dorsalis', svgElementId: 'dorsal-aorta',
      description: 'The dorsal aorta is the anterior extension of the heart tube, carrying hemolymph forward into the head where it is released into the body cavity.',
      funFact: null, hint: 'The forward extension of the heart into the thorax and head.',
      difficultyLevel: 'easy', tags: ['vessel', 'dorsal'] },
    { id: 'struct-grasshopper-cv-003', name: 'Ostia', latinName: 'Ostia', svgElementId: 'ostia',
      description: 'Ostia are paired openings (valved pores) in the heart wall through which hemolymph enters during diastole. Each abdominal segment has one pair.',
      funFact: 'Ostia have one-way valves that open during heart relaxation and snap shut during contraction — the insect equivalent of venous valves.',
      hint: 'Small paired openings along the sides of the heart tube.',
      difficultyLevel: 'medium', tags: ['heart', 'valve'] },
    { id: 'struct-grasshopper-cv-004', name: 'Hemocoel', latinName: 'Haemocoel', svgElementId: 'hemocoel',
      description: 'The hemocoel is the open body cavity filled with hemolymph (insect blood). Unlike vertebrates, hemolymph bathes the organs directly rather than being confined to vessels.',
      funFact: 'Insect hemolymph is usually green or yellowish — not red — because it uses hemocyanin or no oxygen carrier at all (oxygen is delivered by the tracheal system instead).',
      hint: 'The entire open body cavity filled with hemolymph, bathing all internal organs.',
      difficultyLevel: 'medium', tags: ['cavity', 'hemolymph'] },
    { id: 'struct-grasshopper-cv-005', name: 'Alary Muscles', latinName: 'Musculi alares', svgElementId: 'alary-muscles',
      description: 'Fan-shaped muscles that attach the heart to the dorsal body wall. They contract to expand the heart during diastole, helping draw hemolymph in through the ostia.',
      funFact: null, hint: 'Fan-shaped muscles connecting the heart to the body wall.',
      difficultyLevel: 'hard', tags: ['muscle', 'heart'],
      muscleAttachments: 'Fan-shaped fibers from dorsal body wall to heart wall; expand heart during diastole' },
    { id: 'struct-grasshopper-cv-006', name: 'Tracheal Trunks', latinName: 'Trunci tracheales', svgElementId: 'tracheal-trunks',
      description: 'The tracheal trunks are major air tubes that branch throughout the body, delivering oxygen directly to tissues. This replaces the oxygen-carrying function of blood in insects.',
      funFact: 'Insect tracheal tubes are reinforced with spiral rings of chitin (taenidia) that prevent them from collapsing — similar to the cartilage rings in mammalian airways.',
      hint: 'Large branching air tubes running through the body.',
      difficultyLevel: 'medium', tags: ['respiratory', 'tracheal'] },
    { id: 'struct-grasshopper-cv-007', name: 'Spiracles', latinName: 'Spiracula', svgElementId: 'spiracles',
      description: 'Spiracles are external openings along the body sides that connect to the tracheal system. Grasshoppers have 10 pairs (2 thoracic + 8 abdominal).',
      funFact: 'Spiracles can open and close via muscular valves, allowing the insect to regulate gas exchange and minimize water loss.',
      hint: 'Small openings along the sides of the body, 10 pairs total.',
      difficultyLevel: 'medium', tags: ['respiratory', 'external'] },
    { id: 'struct-grasshopper-cv-008', name: 'Air Sacs', latinName: 'Sacci aeriferi', svgElementId: 'air-sacs',
      description: 'Air sacs are expanded, thin-walled portions of the tracheal system that act as bellows, pumping air through the tracheae during active ventilation.',
      funFact: 'Air sacs allow grasshoppers to achieve unidirectional airflow through their tracheal system — surprisingly similar to bird lungs.',
      hint: 'Expanded balloon-like portions of the tracheal tubes.',
      difficultyLevel: 'hard', tags: ['respiratory', 'tracheal'] },
    { id: 'struct-grasshopper-cv-009', name: 'Gastric Caeca', latinName: 'Caeca gastrica', svgElementId: 'gastric-caeca',
      description: 'Gastric caeca are finger-like pouches at the junction of the foregut and midgut that increase the digestive surface area and secrete enzymes.',
      funFact: 'Grasshoppers have 6 gastric caeca that project from the midgut — they dramatically increase absorptive surface area for their plant-based diet.',
      hint: 'Finger-like pouches projecting from the junction of the foregut and midgut.',
      difficultyLevel: 'medium', tags: ['digestive'] },
    { id: 'struct-grasshopper-cv-010', name: 'Malpighian Tubules', latinName: 'Tubuli Malpighii', svgElementId: 'malpighian-tubules',
      description: 'Malpighian tubules are thin, thread-like excretory organs that filter waste products from the hemolymph and empty into the hindgut. They are the insect equivalent of kidneys.',
      funFact: 'Malpighian tubules were first described by Marcello Malpighi in the 17th century — the same anatomist who discovered capillaries.',
      hint: 'Thin thread-like tubes at the junction of the midgut and hindgut.',
      difficultyLevel: 'hard', tags: ['excretory'],
      clinicalNote: 'Malpighian tubules are the target of some insecticides — understanding their function helps develop pest control strategies.' },
  ];

  await seedStructures(grasshopperCvStructures, grasshopperCardioModel.id);
  console.log(`  ✓ ${grasshopperCvStructures.length} cardiovascular structures (Grasshopper)`);

  // ─── CRAYFISH CARDIOVASCULAR STRUCTURES (11) ───────────────────

  const crayfishCvStructures: SeedStructure[] = [
    { id: 'struct-crayfish-cv-001', name: 'Heart', latinName: 'Cor', svgElementId: 'heart',
      description: 'The crayfish heart is a single-chambered, roughly polygonal muscular organ located in the dorsal thorax within the pericardial sinus. It pumps hemolymph through arteries to the open body cavity.',
      funFact: 'The crayfish heart sits in a unique pericardial sinus — a blood-filled cavity that acts as a reservoir, ensuring the heart never runs out of hemolymph to pump.',
      hint: 'A single muscular chamber in the dorsal thorax, surrounded by the pericardial sinus.',
      difficultyLevel: 'easy', tags: ['heart'],
      clinicalNote: 'The single-chambered crustacean heart is the simplest heart students will encounter — a great starting point for understanding cardiac evolution.' },
    { id: 'struct-crayfish-cv-002', name: 'Pericardial Sinus', latinName: 'Sinus pericardialis', svgElementId: 'pericardial-sinus',
      description: 'The pericardial sinus is a hemolymph-filled cavity surrounding the heart. Hemolymph returns here from the gills and enters the heart through the ostia during diastole.',
      funFact: null, hint: 'The cavity surrounding the heart, filled with oxygenated hemolymph returning from the gills.',
      difficultyLevel: 'medium', tags: ['sinus', 'cavity'] },
    { id: 'struct-crayfish-cv-003', name: 'Ostia', latinName: 'Ostia', svgElementId: 'ostia',
      description: 'Three pairs of valved openings (ostia) in the heart wall allow hemolymph to flow from the pericardial sinus into the heart during relaxation.',
      funFact: 'The 6 ostia are arranged as 3 pairs — dorsal, lateral, and ventral — providing 360-degree hemolymph intake.',
      hint: 'Six small slit-like openings in the heart wall, arranged in three pairs.',
      difficultyLevel: 'hard', tags: ['heart', 'valve'] },
    { id: 'struct-crayfish-cv-004', name: 'Anterior Aorta', latinName: 'Aorta anterior (ophthalmicus)', svgElementId: 'anterior-aorta',
      description: 'The anterior (ophthalmic) aorta extends forward from the heart to supply hemolymph to the head, brain, and compound eyes.',
      funFact: 'The anterior aorta is also called the ophthalmic artery because it primarily supplies the large compound eyes of the crayfish.',
      hint: 'An artery extending forward from the heart toward the head and eyes.',
      difficultyLevel: 'medium', tags: ['artery', 'anterior'] },
    { id: 'struct-crayfish-cv-005', name: 'Posterior Aorta', latinName: 'Aorta posterior', svgElementId: 'posterior-aorta',
      description: 'The posterior aorta extends backward from the heart along the dorsal surface of the abdomen, supplying hemolymph to the abdominal segments and tail.',
      funFact: null, hint: 'An artery running backward from the heart along the top of the abdomen.',
      difficultyLevel: 'medium', tags: ['artery', 'posterior'] },
    { id: 'struct-crayfish-cv-006', name: 'Sternal Artery', latinName: 'Arteria sternalis', svgElementId: 'sternal-artery',
      description: 'The sternal artery descends ventrally from the heart, passing between the nerve cord and the gut to supply the ventral thorax, walking legs, and ventral nerve cord.',
      funFact: 'The sternal artery must pass through the nerve cord via a special gap — a unique anatomical arrangement found only in decapod crustaceans.',
      hint: 'An artery descending downward from the heart to the ventral body.',
      difficultyLevel: 'hard', tags: ['artery', 'ventral'] },
    { id: 'struct-crayfish-cv-007', name: 'Hepatic Arteries', latinName: 'Arteriae hepaticae', svgElementId: 'hepatic-arteries',
      description: 'Paired hepatic arteries branch laterally from the heart to supply the large hepatopancreas (digestive gland) on each side.',
      funFact: null, hint: 'Paired arteries extending sideways from the heart to the digestive glands.',
      difficultyLevel: 'hard', tags: ['artery', 'lateral'] },
    { id: 'struct-crayfish-cv-008', name: 'Gills', latinName: 'Branchiae', svgElementId: 'gills',
      description: 'The gills are feathery respiratory organs located at the base of the walking legs, enclosed within the gill chambers (branchiostegites). Hemolymph flows through them to pick up oxygen from the water.',
      funFact: 'Crayfish gills are bathed in a continuous water current created by the maxillipeds (specialized mouthparts) acting as fans — pumping water over the gills.',
      hint: 'Feathery structures at the base of the walking legs, enclosed in gill chambers.',
      difficultyLevel: 'easy', tags: ['respiratory', 'gill'],
      clinicalNote: 'Gill health is a primary indicator of water quality in aquaculture — gill discoloration indicates pollution, low oxygen, or parasitic infection.' },
    { id: 'struct-crayfish-cv-009', name: 'Ventral Sinus', latinName: 'Sinus ventralis (sternalis)', svgElementId: 'ventral-sinus',
      description: 'The ventral (sternal) sinus collects hemolymph that has bathed the organs and tissues. It channels this deoxygenated hemolymph to the gills for reoxygenation.',
      funFact: null, hint: 'A collecting space along the ventral body where hemolymph pools before going to the gills.',
      difficultyLevel: 'medium', tags: ['sinus', 'ventral'] },
    { id: 'struct-crayfish-cv-010', name: 'Hepatopancreas', latinName: 'Hepatopancreas', svgElementId: 'hepatopancreas',
      description: 'The hepatopancreas is a large bilobed digestive gland filling much of the cephalothorax. It combines the functions of the vertebrate liver and pancreas — producing digestive enzymes and absorbing nutrients.',
      funFact: 'The crayfish hepatopancreas can make up 2-6% of total body weight and changes color based on diet — from green to brown to orange.',
      hint: 'A large paired digestive gland filling most of the cephalothorax, on both sides of the midline.',
      difficultyLevel: 'medium', tags: ['digestive', 'gland'] },
    { id: 'struct-crayfish-cv-011', name: 'Green Gland', latinName: 'Glandula antennalis (viridis)', svgElementId: 'green-gland',
      description: 'The green gland (antennal gland) is the crayfish excretory organ, located at the base of each antenna. It filters waste from hemolymph, functioning analogously to vertebrate kidneys.',
      funFact: 'The green gland is named for its greenish color, which comes from accumulated waste products — it is the crustacean equivalent of a kidney.',
      hint: 'A small greenish structure at the base of each antenna, near the front of the head.',
      difficultyLevel: 'hard', tags: ['excretory', 'anterior'] },
  ];

  await seedStructures(crayfishCvStructures, crayfishCardioModel.id);
  console.log(`  ✓ ${crayfishCvStructures.length} cardiovascular structures (Crayfish)`);

  console.log('');

  // ─── DEV / TEST DATA ────────────────────────────────────────────
  // Always seed a dev institution, users, and course so the app is
  // browsable without Canvas LTI.  The /auth/dev-login endpoint uses
  // these records.

  console.log('── Dev / Test Data ────────────────────────────────');

  await prisma.institution.upsert({
    where: { id: 'dev-institution-001' },
    update: {},
    create: {
      id: 'dev-institution-001',
      name: 'AnatoView Dev University',
      canvasUrl: 'https://canvas.dev.example.com',
      ltiClientId: 'dev-lti-client-id',
      ltiDeploymentId: 'dev-lti-deployment-id',
    },
  });
  console.log('  ✓ Institution: AnatoView Dev University');

  await prisma.user.upsert({
    where: { id: 'dev-instructor-001' },
    update: {},
    create: {
      id: 'dev-instructor-001',
      institutionId: 'dev-institution-001',
      canvasUserId: 'canvas-dev-instructor',
      email: 'instructor@anatoview.dev',
      name: 'Dev Instructor',
      role: 'instructor',
    },
  });
  console.log('  ✓ User: Dev Instructor');

  await prisma.user.upsert({
    where: { id: 'dev-student-001' },
    update: {},
    create: {
      id: 'dev-student-001',
      institutionId: 'dev-institution-001',
      canvasUserId: 'canvas-dev-student',
      email: 'student@anatoview.dev',
      name: 'Dev Student',
      role: 'student',
    },
  });
  console.log('  ✓ User: Dev Student');

  await prisma.course.upsert({
    where: { id: 'dev-course-001' },
    update: {},
    create: {
      id: 'dev-course-001',
      institutionId: 'dev-institution-001',
      canvasCourseId: 'canvas-dev-course',
      name: 'BIOL 301 — Comparative Vertebrate Anatomy',
      term: 'Spring 2026',
      instructorId: 'dev-instructor-001',
    },
  });
  console.log('  ✓ Course: BIOL 301');

  console.log('');

  // ─── SUMMARY ───────────────────────────────────────────────────

  const animalCount = await prisma.animal.count();
  const modelCount = await prisma.dissectionModel.count();
  const structureCount = await prisma.anatomicalStructure.count();
  const userCount = await prisma.user.count();
  const courseCount = await prisma.course.count();

  console.log('── Summary ──────────────────────────────────────────');
  console.log(`  Animals:    ${animalCount}`);
  console.log(`  Models:     ${modelCount}`);
  console.log(`  Structures: ${structureCount}`);
  console.log(`  Users:      ${userCount}`);
  console.log(`  Courses:    ${courseCount}`);

  console.log('');
  console.log('✓ Seed complete.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
