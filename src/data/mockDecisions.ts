// =============================================================================
// MOCK DECISION TEMPLATES & DATA
// =============================================================================
// Realistic decision templates for common renovation projects
// =============================================================================

import type {
  DecisionTemplate,
  DecisionCategory,
  CustomerDecisionTracker,
  CustomerDecisionCategory,
} from '../types/decisions';

// ============================================
// DECISION TEMPLATES
// ============================================

export const DECISION_TEMPLATES: DecisionTemplate[] = [
  // -----------------------------------------
  // BATHROOM RENOVATION
  // -----------------------------------------
  {
    id: 'tmpl_bathroom_full',
    name: 'Full Bathroom Renovation',
    description: 'Complete bathroom remodel including fixtures, tiles, and finishes',
    trade: 'bathroom_fitter',
    projectType: 'bathroom',
    estimatedTotalDecisions: 24,
    avgDaysToComplete: 14,
    usageCount: 156,
    isSystemTemplate: true,
    createdAt: '2024-01-01',
    categories: [
      {
        id: 'cat_bath_fixtures',
        name: 'Fixtures & Fittings',
        description: 'Toilet, sink, shower/bath, and taps',
        icon: 'water',
        sortOrder: 1,
        phase: 'rough_in',
        daysBeforePhaseStart: 14,
        items: [
          {
            id: 'item_toilet_style',
            name: 'Toilet Style',
            description: 'Wall-hung or floor-standing toilet',
            helpText: 'Wall-hung toilets are easier to clean but cost more. Floor-standing is traditional.',
            inputType: 'select',
            options: [
              { value: 'wall_hung', label: 'Wall-hung', description: 'Modern, easy to clean', priceImpact: 200 },
              { value: 'floor_standing', label: 'Floor-standing', description: 'Traditional, lower cost', priceImpact: 0 },
              { value: 'back_to_wall', label: 'Back-to-wall', description: 'Concealed cistern', priceImpact: 150 },
            ],
            priority: 'critical',
            impactIfDelayed: 'Plumbing rough-in cannot proceed without toilet position',
          },
          {
            id: 'item_sink_type',
            name: 'Sink/Basin Type',
            description: 'Style of bathroom sink',
            inputType: 'select',
            options: [
              { value: 'pedestal', label: 'Pedestal', priceImpact: 0 },
              { value: 'wall_mounted', label: 'Wall-mounted', priceImpact: 50 },
              { value: 'vanity_unit', label: 'Vanity unit with storage', priceImpact: 250 },
              { value: 'countertop', label: 'Countertop basin', priceImpact: 150 },
            ],
            priority: 'critical',
            impactIfDelayed: 'Vanity units need to be ordered 2-3 weeks ahead',
          },
          {
            id: 'item_shower_or_bath',
            name: 'Shower, Bath, or Both?',
            description: 'Main bathing fixture choice',
            inputType: 'select',
            options: [
              { value: 'shower_only', label: 'Shower only', priceImpact: 0 },
              { value: 'bath_only', label: 'Bath only', priceImpact: 100 },
              { value: 'bath_shower', label: 'Bath with shower over', priceImpact: 150 },
              { value: 'separate', label: 'Separate shower and bath', priceImpact: 400 },
            ],
            priority: 'critical',
            impactIfDelayed: 'Affects entire bathroom layout and plumbing',
          },
          {
            id: 'item_tap_style',
            name: 'Tap/Faucet Finish',
            description: 'Chrome, brushed nickel, black, or brass',
            inputType: 'select',
            options: [
              { value: 'chrome', label: 'Chrome', priceImpact: 0 },
              { value: 'brushed_nickel', label: 'Brushed Nickel', priceImpact: 50 },
              { value: 'matte_black', label: 'Matte Black', priceImpact: 75 },
              { value: 'brass', label: 'Brass/Gold', priceImpact: 100 },
            ],
            priority: 'important',
            impactIfDelayed: 'Taps may have 2-3 week lead time',
          },
        ],
      },
      {
        id: 'cat_bath_tiles',
        name: 'Tiles & Surfaces',
        description: 'Floor and wall tile selections',
        icon: 'grid',
        sortOrder: 2,
        phase: 'installation',
        daysBeforePhaseStart: 21,
        items: [
          {
            id: 'item_floor_tile',
            name: 'Floor Tile Selection',
            description: 'Choose floor tile (provide photo or link)',
            helpText: 'Non-slip rating is important for bathroom floors',
            inputType: 'photo',
            photoRequired: true,
            priority: 'critical',
            impactIfDelayed: 'Tiles often have 2-4 week delivery',
          },
          {
            id: 'item_wall_tile',
            name: 'Wall Tile Selection',
            description: 'Choose wall tile (provide photo or link)',
            inputType: 'photo',
            photoRequired: true,
            priority: 'critical',
            impactIfDelayed: 'Tiles often have 2-4 week delivery',
          },
          {
            id: 'item_tile_height',
            name: 'Wall Tile Height',
            description: 'How high should wall tiles go?',
            inputType: 'select',
            options: [
              { value: 'splashback', label: 'Splashback only (60cm)', priceImpact: -200 },
              { value: 'half_wall', label: 'Half wall (120cm)', priceImpact: 0 },
              { value: 'full_height', label: 'Full height (to ceiling)', priceImpact: 300 },
            ],
            priority: 'important',
            impactIfDelayed: 'Need to order correct tile quantity',
          },
          {
            id: 'item_grout_color',
            name: 'Grout Color',
            description: 'Match or contrast with tiles',
            inputType: 'select',
            options: [
              { value: 'white', label: 'White', priceImpact: 0 },
              { value: 'grey', label: 'Grey', priceImpact: 0 },
              { value: 'black', label: 'Black', priceImpact: 10 },
              { value: 'match', label: 'Match tile color', priceImpact: 20 },
            ],
            priority: 'optional',
            impactIfDelayed: 'Can be decided during installation',
          },
        ],
      },
      {
        id: 'cat_bath_electrical',
        name: 'Electrical',
        description: 'Lighting and electrical points',
        icon: 'flash',
        sortOrder: 3,
        phase: 'rough_in',
        daysBeforePhaseStart: 10,
        items: [
          {
            id: 'item_mirror_light',
            name: 'Mirror Lighting',
            description: 'Type of lighting around mirror',
            inputType: 'select',
            options: [
              { value: 'none', label: 'No mirror light', priceImpact: -50 },
              { value: 'above', label: 'Light above mirror', priceImpact: 0 },
              { value: 'sides', label: 'Lights on sides', priceImpact: 50 },
              { value: 'backlit', label: 'Backlit mirror', priceImpact: 150 },
            ],
            priority: 'important',
            impactIfDelayed: 'Electrical first fix needs this info',
          },
          {
            id: 'item_heated_floor',
            name: 'Underfloor Heating',
            description: 'Electric underfloor heating in bathroom',
            inputType: 'boolean',
            priority: 'important',
            impactIfDelayed: 'Must be installed before tiles',
          },
          {
            id: 'item_extractor',
            name: 'Extractor Fan Location',
            description: 'Where should the extractor fan be?',
            inputType: 'select',
            options: [
              { value: 'ceiling', label: 'Ceiling mounted', priceImpact: 0 },
              { value: 'wall', label: 'Wall mounted', priceImpact: 0 },
              { value: 'window', label: 'Window fan', priceImpact: -30 },
            ],
            priority: 'important',
            impactIfDelayed: 'Affects ductwork routing',
          },
        ],
      },
    ],
  },

  // -----------------------------------------
  // KITCHEN RENOVATION
  // -----------------------------------------
  {
    id: 'tmpl_kitchen_full',
    name: 'Full Kitchen Renovation',
    description: 'Complete kitchen remodel with cabinets, appliances, and finishes',
    trade: 'kitchen_fitter',
    projectType: 'kitchen',
    estimatedTotalDecisions: 32,
    avgDaysToComplete: 21,
    usageCount: 203,
    isSystemTemplate: true,
    createdAt: '2024-01-01',
    categories: [
      {
        id: 'cat_kitchen_cabinets',
        name: 'Cabinets & Layout',
        description: 'Cabinet style, color, and layout decisions',
        icon: 'cube',
        sortOrder: 1,
        phase: 'planning',
        daysBeforePhaseStart: 28,
        items: [
          {
            id: 'item_cabinet_style',
            name: 'Cabinet Door Style',
            description: 'Shaker, flat/slab, or raised panel',
            inputType: 'select',
            options: [
              { value: 'shaker', label: 'Shaker', description: 'Classic with recessed center' },
              { value: 'flat', label: 'Flat/Slab', description: 'Modern minimalist' },
              { value: 'raised', label: 'Raised Panel', description: 'Traditional ornate' },
            ],
            priority: 'critical',
            impactIfDelayed: 'Cabinets have 4-6 week lead time',
          },
          {
            id: 'item_cabinet_color',
            name: 'Cabinet Color/Finish',
            description: 'Main cabinet color',
            inputType: 'color',
            helpText: 'Popular choices: White, grey, navy, natural wood',
            priority: 'critical',
            impactIfDelayed: 'Color affects countertop and backsplash choice',
          },
          {
            id: 'item_cabinet_hardware',
            name: 'Cabinet Hardware',
            description: 'Handles/knobs style',
            inputType: 'select',
            options: [
              { value: 'none', label: 'Push-to-open (no handles)' },
              { value: 'bar', label: 'Bar pulls' },
              { value: 'cup', label: 'Cup pulls' },
              { value: 'knob', label: 'Knobs' },
            ],
            priority: 'important',
            impactIfDelayed: 'Can be added later but holes need planning',
          },
        ],
      },
      {
        id: 'cat_kitchen_counters',
        name: 'Countertops',
        description: 'Worktop material and edge profile',
        icon: 'layers',
        sortOrder: 2,
        phase: 'installation',
        daysBeforePhaseStart: 21,
        items: [
          {
            id: 'item_counter_material',
            name: 'Countertop Material',
            description: 'Main work surface material',
            inputType: 'select',
            options: [
              { value: 'laminate', label: 'Laminate', priceImpact: 0 },
              { value: 'quartz', label: 'Quartz', priceImpact: 1500 },
              { value: 'granite', label: 'Granite', priceImpact: 1200 },
              { value: 'solid_surface', label: 'Solid Surface (Corian)', priceImpact: 800 },
              { value: 'butcher_block', label: 'Butcher Block', priceImpact: 400 },
            ],
            priority: 'critical',
            impactIfDelayed: 'Stone counters need 2-3 weeks for fabrication',
          },
          {
            id: 'item_counter_color',
            name: 'Countertop Color/Pattern',
            description: 'Specific slab or color selection',
            inputType: 'photo',
            helpText: 'Visit showroom or send photo of preferred option',
            priority: 'critical',
            impactIfDelayed: 'Popular colors may not be in stock',
          },
          {
            id: 'item_backsplash',
            name: 'Backsplash Height',
            description: 'Standard or full-height backsplash',
            inputType: 'select',
            options: [
              { value: 'standard', label: 'Standard (10cm upstand)' },
              { value: 'full', label: 'Full height (to cabinets)' },
              { value: 'ceiling', label: 'To ceiling (no upper cabinets)' },
            ],
            priority: 'important',
            impactIfDelayed: 'Affects tile ordering',
          },
        ],
      },
      {
        id: 'cat_kitchen_appliances',
        name: 'Appliances',
        description: 'Built-in and freestanding appliances',
        icon: 'cafe',
        sortOrder: 3,
        phase: 'installation',
        daysBeforePhaseStart: 14,
        items: [
          {
            id: 'item_hob_type',
            name: 'Hob/Cooktop Type',
            description: 'Gas, electric, or induction',
            inputType: 'select',
            options: [
              { value: 'gas', label: 'Gas' },
              { value: 'ceramic', label: 'Ceramic Electric' },
              { value: 'induction', label: 'Induction' },
            ],
            priority: 'critical',
            impactIfDelayed: 'Affects electrical and gas requirements',
          },
          {
            id: 'item_oven_config',
            name: 'Oven Configuration',
            description: 'Single, double, or range cooker',
            inputType: 'select',
            options: [
              { value: 'single', label: 'Single built-in oven' },
              { value: 'double', label: 'Double built-in oven' },
              { value: 'range', label: 'Range cooker' },
            ],
            priority: 'critical',
            impactIfDelayed: 'Cabinet cutouts depend on this',
          },
          {
            id: 'item_fridge_size',
            name: 'Refrigerator Size',
            description: 'Fridge/freezer dimensions',
            inputType: 'select',
            options: [
              { value: 'under_counter', label: 'Under-counter' },
              { value: 'tall_50_50', label: 'Tall 50/50 fridge/freezer' },
              { value: 'tall_70_30', label: 'Tall 70/30 fridge/freezer' },
              { value: 'american', label: 'American style' },
            ],
            priority: 'critical',
            impactIfDelayed: 'Affects cabinet layout',
          },
        ],
      },
      {
        id: 'cat_kitchen_electrical',
        name: 'Electrical & Lighting',
        description: 'Outlets and lighting positions',
        icon: 'flash',
        sortOrder: 4,
        phase: 'rough_in',
        daysBeforePhaseStart: 14,
        items: [
          {
            id: 'item_outlet_count',
            name: 'Counter Outlet Quantity',
            description: 'Number of outlets on backsplash',
            inputType: 'number',
            unit: 'outlets',
            helpText: 'Recommend minimum 4-6 for modern kitchen',
            exampleAnswer: '6',
            priority: 'important',
            impactIfDelayed: 'Must be done before tiling',
          },
          {
            id: 'item_under_cabinet_lights',
            name: 'Under-Cabinet Lighting',
            description: 'LED strips under wall cabinets',
            inputType: 'boolean',
            priority: 'important',
            impactIfDelayed: 'Wiring needed before cabinets go up',
          },
          {
            id: 'item_pendant_lights',
            name: 'Pendant Lights Over Island',
            description: 'Number and position of pendant lights',
            inputType: 'number',
            unit: 'pendants',
            helpText: 'Usually 2-3 pendants for standard island',
            priority: 'optional',
            impactIfDelayed: 'Electrical box positions needed early',
          },
        ],
      },
    ],
  },

  // -----------------------------------------
  // INTERIOR PAINTING
  // -----------------------------------------
  {
    id: 'tmpl_painting_interior',
    name: 'Interior Painting',
    description: 'Full interior paint including walls, ceilings, and trim',
    trade: 'painter',
    projectType: 'painting',
    estimatedTotalDecisions: 12,
    avgDaysToComplete: 7,
    usageCount: 342,
    isSystemTemplate: true,
    createdAt: '2024-01-01',
    categories: [
      {
        id: 'cat_paint_colors',
        name: 'Paint Colors',
        description: 'Color selections for each room',
        icon: 'color-palette',
        sortOrder: 1,
        phase: 'planning',
        daysBeforePhaseStart: 7,
        items: [
          {
            id: 'item_wall_color_living',
            name: 'Living Room Wall Color',
            description: 'Main wall color for living room',
            inputType: 'color',
            helpText: 'Provide brand and color code (e.g., Dulux White Mist)',
            exampleAnswer: 'Farrow & Ball - Elephant\'s Breath',
            priority: 'critical',
            impactIfDelayed: 'Paint needs to be ordered/mixed',
          },
          {
            id: 'item_wall_color_bedroom',
            name: 'Bedroom Wall Colors',
            description: 'Color for each bedroom',
            inputType: 'text',
            helpText: 'List room and color for each',
            priority: 'critical',
            impactIfDelayed: 'Paint needs to be ordered/mixed',
          },
          {
            id: 'item_ceiling_color',
            name: 'Ceiling Color',
            description: 'Same as walls or different?',
            inputType: 'select',
            options: [
              { value: 'white', label: 'Standard white' },
              { value: 'match', label: 'Match wall color' },
              { value: 'lighter', label: 'Lighter shade of wall color' },
              { value: 'custom', label: 'Different color (specify)' },
            ],
            priority: 'important',
            impactIfDelayed: 'Minor - can adjust during work',
          },
          {
            id: 'item_trim_color',
            name: 'Trim/Woodwork Color',
            description: 'Skirting, door frames, window frames',
            inputType: 'select',
            options: [
              { value: 'white_satin', label: 'White (satin finish)' },
              { value: 'white_gloss', label: 'White (gloss finish)' },
              { value: 'match_walls', label: 'Match walls' },
              { value: 'contrast', label: 'Contrast color (specify)' },
            ],
            priority: 'important',
            impactIfDelayed: 'Minor - can adjust during work',
          },
        ],
      },
      {
        id: 'cat_paint_finish',
        name: 'Paint Finish & Quality',
        description: 'Sheen level and paint quality',
        icon: 'sparkles',
        sortOrder: 2,
        phase: 'planning',
        daysBeforePhaseStart: 5,
        items: [
          {
            id: 'item_wall_finish',
            name: 'Wall Paint Finish',
            description: 'Sheen level for walls',
            inputType: 'select',
            options: [
              { value: 'flat', label: 'Flat/Matte', description: 'Hides imperfections, not washable' },
              { value: 'eggshell', label: 'Eggshell', description: 'Slight sheen, washable' },
              { value: 'satin', label: 'Satin', description: 'Medium sheen, very washable' },
            ],
            priority: 'important',
            impactIfDelayed: 'Affects paint ordering',
          },
          {
            id: 'item_paint_quality',
            name: 'Paint Quality Level',
            description: 'Premium or standard paint',
            inputType: 'select',
            options: [
              { value: 'standard', label: 'Standard quality', priceImpact: 0 },
              { value: 'premium', label: 'Premium (Farrow & Ball, Little Greene)', priceImpact: 300 },
            ],
            priority: 'optional',
            impactIfDelayed: 'Premium paints may need ordering',
          },
        ],
      },
      {
        id: 'cat_paint_prep',
        name: 'Preparation Work',
        description: 'Repairs and prep before painting',
        icon: 'construct',
        sortOrder: 3,
        phase: 'planning',
        daysBeforePhaseStart: 3,
        items: [
          {
            id: 'item_wall_repairs',
            name: 'Wall Repairs Needed',
            description: 'Any holes, cracks, or damage to repair?',
            inputType: 'text',
            helpText: 'List any areas needing repair',
            priority: 'important',
            impactIfDelayed: 'May need extra materials',
          },
          {
            id: 'item_wallpaper_removal',
            name: 'Wallpaper Removal',
            description: 'Any wallpaper to be removed?',
            inputType: 'boolean',
            priority: 'critical',
            impactIfDelayed: 'Significantly affects timeline',
          },
        ],
      },
    ],
  },

  // -----------------------------------------
  // ELECTRICAL WORK
  // -----------------------------------------
  {
    id: 'tmpl_electrical_upgrade',
    name: 'Electrical Upgrade',
    description: 'Electrical upgrades including outlets, switches, and lighting',
    trade: 'electrician',
    projectType: 'electrical',
    estimatedTotalDecisions: 18,
    avgDaysToComplete: 10,
    usageCount: 128,
    isSystemTemplate: true,
    createdAt: '2024-01-01',
    categories: [
      {
        id: 'cat_elec_outlets',
        name: 'Outlets & Switches',
        description: 'Outlet and switch positions and types',
        icon: 'power',
        sortOrder: 1,
        phase: 'rough_in',
        daysBeforePhaseStart: 7,
        items: [
          {
            id: 'item_outlet_style',
            name: 'Outlet/Switch Style',
            description: 'Modern flat, traditional, or smart',
            inputType: 'select',
            options: [
              { value: 'standard', label: 'Standard white', priceImpact: 0 },
              { value: 'screwless', label: 'Screwless flat plate', priceImpact: 5 },
              { value: 'chrome', label: 'Chrome/metal finish', priceImpact: 15 },
              { value: 'smart', label: 'Smart switches', priceImpact: 50 },
            ],
            priority: 'important',
            impactIfDelayed: 'Non-standard may need ordering',
          },
          {
            id: 'item_outlet_height',
            name: 'Outlet Height',
            description: 'Standard or higher position',
            inputType: 'select',
            options: [
              { value: 'standard', label: 'Standard (30cm from floor)' },
              { value: 'higher', label: 'Higher (45cm - easier access)' },
              { value: 'counter', label: 'Counter height (where applicable)' },
            ],
            priority: 'important',
            impactIfDelayed: 'Must decide before first fix',
          },
          {
            id: 'item_usb_outlets',
            name: 'USB Outlets',
            description: 'Outlets with built-in USB charging',
            inputType: 'number',
            unit: 'outlets',
            helpText: 'Recommend 2-4 in common areas',
            priority: 'optional',
            impactIfDelayed: 'Minor - can substitute during work',
          },
        ],
      },
      {
        id: 'cat_elec_lighting',
        name: 'Lighting',
        description: 'Ceiling lights, spots, and dimmers',
        icon: 'bulb',
        sortOrder: 2,
        phase: 'rough_in',
        daysBeforePhaseStart: 7,
        items: [
          {
            id: 'item_downlights_count',
            name: 'Downlight Quantity per Room',
            description: 'Number of recessed spotlights',
            inputType: 'text',
            helpText: 'List by room: Living 6, Kitchen 8, etc.',
            priority: 'critical',
            impactIfDelayed: 'Ceiling needs cutting before plastering',
          },
          {
            id: 'item_dimmer_switches',
            name: 'Dimmer Switches',
            description: 'Which rooms should have dimmers?',
            inputType: 'multiselect',
            options: [
              { value: 'living', label: 'Living room' },
              { value: 'dining', label: 'Dining room' },
              { value: 'bedroom', label: 'Bedrooms' },
              { value: 'bathroom', label: 'Bathroom' },
            ],
            priority: 'important',
            impactIfDelayed: 'Wiring differs for dimmers',
          },
          {
            id: 'item_light_color',
            name: 'LED Color Temperature',
            description: 'Warm white, cool white, or daylight',
            inputType: 'select',
            options: [
              { value: 'warm', label: 'Warm white (2700K) - cozy' },
              { value: 'neutral', label: 'Neutral white (4000K) - balanced' },
              { value: 'cool', label: 'Cool white (5000K) - bright/clinical' },
            ],
            priority: 'optional',
            impactIfDelayed: 'Can be changed after (if using LED bulbs)',
          },
        ],
      },
    ],
  },
];

// ============================================
// MOCK ACTIVE TRACKERS
// ============================================

export const MOCK_ACTIVE_TRACKERS: CustomerDecisionTracker[] = [
  {
    id: 'tracker_1',
    jobId: 'job_1',
    customerId: 'cust_vandenberg',
    customerName: 'Familie van den Berg',
    customerPhone: '+31 6 1234 5678',
    customerEmail: 'vandenberg@email.nl',
    templateId: 'tmpl_bathroom_full',
    templateName: 'Full Bathroom Renovation',
    projectStartDate: '2024-02-15',
    phases: [
      { phase: 'planning', startDate: '2024-01-20' },
      { phase: 'demolition', startDate: '2024-02-15' },
      { phase: 'rough_in', startDate: '2024-02-19' },
      { phase: 'installation', startDate: '2024-02-26' },
      { phase: 'finishing', startDate: '2024-03-04' },
    ],
    totalDecisions: 15,
    decidedCount: 9,
    pendingCount: 4,
    overdueCount: 2,
    lastReminderSent: '2024-01-30T10:00:00Z',
    reminderFrequency: 'every_2_days',
    preferredChannel: 'whatsapp',
    status: 'active',
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-30T14:30:00Z',
    categories: [
      {
        id: 'cat_1',
        categoryId: 'cat_bath_fixtures',
        name: 'Fixtures & Fittings',
        phase: 'rough_in',
        dueDate: '2024-02-05',
        isOverdue: true,
        completedCount: 3,
        totalCount: 4,
        items: [
          {
            id: 'dec_1',
            itemId: 'item_toilet_style',
            name: 'Toilet Style',
            description: 'Wall-hung or floor-standing toilet',
            inputType: 'select',
            options: [
              { value: 'wall_hung', label: 'Wall-hung' },
              { value: 'floor_standing', label: 'Floor-standing' },
            ],
            priority: 'critical',
            status: 'decided',
            value: 'wall_hung',
            decidedAt: '2024-01-22T15:30:00Z',
            dueDate: '2024-02-05',
            isOverdue: false,
            remindersSent: 0,
          },
          {
            id: 'dec_2',
            itemId: 'item_sink_type',
            name: 'Sink/Basin Type',
            description: 'Style of bathroom sink',
            inputType: 'select',
            options: [
              { value: 'pedestal', label: 'Pedestal' },
              { value: 'vanity_unit', label: 'Vanity unit' },
            ],
            priority: 'critical',
            status: 'decided',
            value: 'vanity_unit',
            decidedAt: '2024-01-22T15:32:00Z',
            dueDate: '2024-02-05',
            isOverdue: false,
            remindersSent: 0,
          },
          {
            id: 'dec_3',
            itemId: 'item_shower_or_bath',
            name: 'Shower, Bath, or Both?',
            description: 'Main bathing fixture choice',
            inputType: 'select',
            priority: 'critical',
            status: 'decided',
            value: 'bath_shower',
            decidedAt: '2024-01-22T15:35:00Z',
            dueDate: '2024-02-05',
            isOverdue: false,
            remindersSent: 0,
          },
          {
            id: 'dec_4',
            itemId: 'item_tap_style',
            name: 'Tap/Faucet Finish',
            description: 'Chrome, brushed nickel, black, or brass',
            inputType: 'select',
            options: [
              { value: 'chrome', label: 'Chrome' },
              { value: 'matte_black', label: 'Matte Black' },
              { value: 'brushed_nickel', label: 'Brushed Nickel' },
            ],
            priority: 'important',
            status: 'pending',
            dueDate: '2024-02-05',
            isOverdue: true,
            remindersSent: 2,
            lastReminderAt: '2024-01-30T10:00:00Z',
          },
        ],
      },
      {
        id: 'cat_2',
        categoryId: 'cat_bath_tiles',
        name: 'Tiles & Surfaces',
        phase: 'installation',
        dueDate: '2024-02-05',
        isOverdue: true,
        completedCount: 2,
        totalCount: 4,
        items: [
          {
            id: 'dec_5',
            itemId: 'item_floor_tile',
            name: 'Floor Tile Selection',
            description: 'Choose floor tile',
            inputType: 'photo',
            priority: 'critical',
            status: 'decided',
            value: 'Terrazzo Grey 60x60',
            photoUrl: 'https://example.com/tile1.jpg',
            decidedAt: '2024-01-25T11:00:00Z',
            dueDate: '2024-02-05',
            isOverdue: false,
            remindersSent: 0,
          },
          {
            id: 'dec_6',
            itemId: 'item_wall_tile',
            name: 'Wall Tile Selection',
            description: 'Choose wall tile',
            inputType: 'photo',
            priority: 'critical',
            status: 'pending',
            dueDate: '2024-02-05',
            isOverdue: true,
            remindersSent: 3,
            lastReminderAt: '2024-01-30T10:00:00Z',
          },
          {
            id: 'dec_7',
            itemId: 'item_tile_height',
            name: 'Wall Tile Height',
            description: 'How high should wall tiles go?',
            inputType: 'select',
            priority: 'important',
            status: 'decided',
            value: 'full_height',
            decidedAt: '2024-01-25T11:05:00Z',
            dueDate: '2024-02-05',
            isOverdue: false,
            remindersSent: 0,
          },
          {
            id: 'dec_8',
            itemId: 'item_grout_color',
            name: 'Grout Color',
            description: 'Match or contrast with tiles',
            inputType: 'select',
            priority: 'optional',
            status: 'pending',
            dueDate: '2024-02-12',
            isOverdue: false,
            remindersSent: 0,
          },
        ],
      },
    ],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getTemplateById(id: string): DecisionTemplate | undefined {
  return DECISION_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByTrade(trade: string): DecisionTemplate[] {
  return DECISION_TEMPLATES.filter(t => t.trade === trade);
}

export function getTrackerStats(tracker: CustomerDecisionTracker) {
  const overdue = tracker.categories.flatMap(c =>
    c.items.filter(i => i.isOverdue && i.status === 'pending')
  );

  const upcoming = tracker.categories.flatMap(c =>
    c.items.filter(i => !i.isOverdue && i.status === 'pending')
  );

  const decided = tracker.categories.flatMap(c =>
    c.items.filter(i => i.status === 'decided')
  );

  return {
    overdue: overdue.length,
    upcoming: upcoming.length,
    decided: decided.length,
    total: overdue.length + upcoming.length + decided.length,
    completionPercent: Math.round((decided.length / (overdue.length + upcoming.length + decided.length)) * 100),
  };
}
