BEGIN;

WITH inventory (name, category, description, working_quantity) AS (
    VALUES
        ('لوحة أردوينو (Arduino)', 'Arduino Kit', NULL, 9),
        ('كبل/وصلة أردوينو', 'Arduino Kit', NULL, 9),
        ('لوحة تجارب (Breadboard)', 'Arduino Kit', NULL, 9),
        ('شاشة (LCD) مع وصلاتها', 'Arduino Kit', NULL, 10),
        ('مقاومة متغيرة (Potentiometer)', 'Arduino Kit', NULL, 9),
        ('حساس منسوب المياه', 'Arduino Kit', NULL, 10),
        ('حساس صوت', 'Arduino Kit', NULL, 9),
        ('حساس رطوبة الجو', 'Arduino Kit', NULL, 4),
        ('قارئ/حساس (RFID)', 'Arduino Kit', NULL, 10),
        ('ريليه (Relay)', 'Arduino Kit', NULL, 10),
        ('محرك سيرفو (Servo) مع شفراتها', 'Arduino Kit', NULL, 7),
        ('محرك خطوي (Stepper)', 'Arduino Kit', NULL, 8),
        ('دارة قيادة لمحركات Stepper', 'Arduino Kit', 'يسجل ملف الجرد وجود ثلاث دارات إضافية تنتظر محركات.', 11),
        ('لوحة مفاتيح ماتريكس (4×4)', 'Arduino Kit', NULL, 10),
        ('عصا تحكم (Joystick)', 'Arduino Kit', NULL, 8),
        ('ريموت (IR)', 'Arduino Kit', NULL, 10),
        ('جهاز تحكم', 'Arduino Kit', 'إحدى القطع عليها ملصق: يحتاج بطارية.', 10),
        ('مصفوفة ليدات ماتريكس (8×8)', 'Arduino Kit', NULL, 10),
        ('شاشة (7-Segment) زوجية', 'Arduino Kit', NULL, 10),
        ('شاشة (7-Segment) فردية', 'Arduino Kit', NULL, 9),
        ('وحدة (RGB)', 'Arduino Kit', NULL, 11),
        ('مقاومة ضوئية (LDR)', 'Arduino Kit', NULL, 22),
        ('مؤقت (Timer)', 'Arduino Kit', NULL, 10),
        ('ESP32', 'ESP32 Kit', NULL, 12),
        ('Micro USB', 'ESP32 Kit', NULL, 12),
        ('F-M wires', 'ESP32 Kit', NULL, 240),
        ('M-M wires', 'ESP32 Kit', NULL, 120),
        ('Test board', 'ESP32 Kit', NULL, 11),
        ('جكة ثلاثية', 'ESP32 Kit', NULL, 12),
        ('Serial wires', 'ESP32 Kit', NULL, 96),
        ('حساس حركة', 'ESP32 Kit', NULL, 12),
        ('LED', 'ESP32 Kit', NULL, 240),
        ('شاشة LCD صغيرة', 'ESP32 Kit', NULL, 12),
        ('مقاومة متغيرة', 'ESP32 Kit', NULL, 12),
        ('Gyro sensor', 'ESP32 Kit', NULL, 12),
        ('Ultrasonic', 'ESP32 Kit', NULL, 12),
        ('DC motor', 'ESP32 Kit', NULL, 11),
        ('Servo motor', 'ESP32 Kit', NULL, 11),
        ('Keypad', 'ESP32 Kit', NULL, 11),
        ('Push button', 'ESP32 Kit', NULL, 6),
        ('2222 A', 'ESP32 Kit', NULL, 48),
        ('BC516', 'ESP32 Kit', NULL, 24),
        ('MCP 9700E', 'ESP32 Kit', NULL, 22),
        ('JC29 07A', 'ESP32 Kit', NULL, 24),
        ('مقاومة', 'ESP32 Kit', NULL, 324),
        ('مكثف كيميائي', 'ESP32 Kit', NULL, 24),
        ('مكثف سيراميك', 'ESP32 Kit', NULL, 72),
        ('7 segments dual', 'ESP32 Kit', NULL, 11),
        ('LDR', 'ESP32 Kit', NULL, 48),
        ('LD33CV', 'ESP32 Kit', NULL, 12),
        ('L9110H', 'ESP32 Kit', NULL, 11),
        ('IR sensor', 'ESP32 Kit', NULL, 12)
),
inserted_components AS (
    INSERT INTO "components" (
        "name",
        "category",
        "description",
        "working_quantity",
        "broken_quantity",
        "status",
        "created_at",
        "updated_at"
    )
    SELECT
        inventory.name,
        inventory.category,
        inventory.description,
        0,
        0,
        'active',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM inventory
    RETURNING "id", "name", "category"
)
INSERT INTO "inventory_movements" (
    "component_id",
    "movement_type",
    "quantity_bucket",
    "quantity_delta",
    "occurred_at",
    "notes"
)
SELECT
    inserted_components.id,
    'INITIAL_STOCK_IMPORT',
    'working',
    inventory.working_quantity,
    CURRENT_TIMESTAMP,
    CASE inventory.category
        WHEN 'Arduino Kit' THEN 'Opening count imported from Arduino_Kits_Standardized_Inventory.xlsx.'
        ELSE 'Opening count imported from ESP-32 Kits.xlsx.'
    END
FROM inserted_components
JOIN inventory
  ON inventory.name = inserted_components.name
 AND inventory.category = inserted_components.category;

COMMIT;
