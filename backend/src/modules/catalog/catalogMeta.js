// Display metadata for the imported kit inventory (Arduino + ESP32 Excel files).
// Keyed by the component name stored in the database. Used for:
//  - the English label shown under each Arabic name in the UI (nameEn)
//  - keyword matching for the read-only AI assistant tools
// The image of each component lives in components.image_reference (see the
// 20261116090000_component_images migration); nothing here changes the schema.

const catalogMeta = {
  "لوحة أردوينو (Arduino)": { en: "Arduino Uno Board", tags: "arduino uno microcontroller board controller متحكم لوحة تحكم" },
  "كبل/وصلة أردوينو": { en: "Arduino USB Cable", tags: "usb cable كبل وصلة برمجة" },
  "لوحة تجارب (Breadboard)": { en: "Solderless Breadboard", tags: "breadboard prototyping لوحة تجارب" },
  "شاشة (LCD) مع وصلاتها": { en: "16x2 LCD Module with Wiring", tags: "lcd display screen شاشة عرض" },
  "مقاومة متغيرة (Potentiometer)": { en: "Rotary Potentiometer", tags: "potentiometer knob variable resistor مقاومة متغيرة تحكم" },
  "حساس منسوب المياه": { en: "Water Level Sensor", tags: "water level liquid sensor ماء مياه منسوب خزان" },
  "حساس صوت": { en: "Sound Sensor", tags: "sound microphone noise clap صوت ميكروفون" },
  "حساس رطوبة الجو": { en: "Humidity Sensor (DHT)", tags: "dht humidity temperature weather رطوبة حرارة طقس" },
  "قارئ/حساس (RFID)": { en: "RFID Reader Module", tags: "rfid nfc card access بطاقة دخول" },
  "ريليه (Relay)": { en: "5V Relay Module", tags: "relay switch high voltage ريليه تشغيل اجهزة" },
  "محرك سيرفو (Servo) مع شفراتها": { en: "SG90 Servo Motor and Horns", tags: "servo motor angle arm محرك سيرفو ذراع" },
  "محرك خطوي (Stepper)": { en: "28BYJ-48 Stepper Motor", tags: "stepper motor precise محرك خطوي" },
  "دارة قيادة لمحركات Stepper": { en: "ULN2003 Stepper Driver", tags: "stepper driver uln2003 دارة قيادة" },
  "لوحة مفاتيح ماتريكس (4×4)": { en: "4x4 Matrix Keypad", tags: "keypad password input لوحة مفاتيح ادخال" },
  "عصا تحكم (Joystick)": { en: "Joystick Module", tags: "joystick control game عصا تحكم" },
  "ريموت (IR)": { en: "Infrared Remote Control", tags: "ir remote infrared ريموت اشعة" },
  "جهاز تحكم": { en: "Remote Controller", tags: "remote controller جهاز تحكم" },
  "مصفوفة ليدات ماتريكس (8×8)": { en: "8x8 LED Matrix", tags: "led matrix display مصفوفة ليدات" },
  "شاشة (7-Segment) زوجية": { en: "Dual 7-Segment Display", tags: "7 segment display counter عداد" },
  "شاشة (7-Segment) فردية": { en: "Single 7-Segment Display", tags: "7 segment display digit رقم" },
  "وحدة (RGB)": { en: "RGB LED Module", tags: "rgb led color light الوان اضاءة" },
  "مقاومة ضوئية (LDR)": { en: "Light-Dependent Resistor (LDR)", tags: "ldr light sensor ضوء اضاءة" },
  "مؤقت (Timer)": { en: "NE555 Timer IC", tags: "555 timer ic مؤقت" },
  "ESP32": { en: "ESP32 Development Board", tags: "esp32 wifi bluetooth iot internet microcontroller واي فاي بلوتوث انترنت" },
  "Micro USB": { en: "Micro-USB Cable", tags: "micro usb cable كبل" },
  "F-M wires": { en: "Female-to-Male Jumper Wires", tags: "jumper wires أسلاك" },
  "M-M wires": { en: "Male-to-Male Jumper Wires", tags: "jumper wires أسلاك" },
  "Test board": { en: "Solderless Breadboard", tags: "breadboard test board لوحة تجارب" },
  "جكة ثلاثية": { en: "3-Pin Header Connector", tags: "header connector pin وصلة" },
  "Serial wires": { en: "Serial Jumper Wires", tags: "serial wires أسلاك" },
  "حساس حركة": { en: "PIR Motion Sensor", tags: "pir motion presence security حركة انذار" },
  "LED": { en: "LEDs", tags: "led light indicator ليد ضوء" },
  "شاشة LCD صغيرة": { en: "16x2 I2C LCD Module", tags: "lcd i2c display screen شاشة" },
  "مقاومة متغيرة": { en: "Rotary Potentiometer", tags: "potentiometer knob مقاومة متغيرة" },
  "Gyro sensor": { en: "MPU6050 Gyroscope Module", tags: "gyro mpu6050 accelerometer balance orientation جيروسكوب توازن" },
  "Ultrasonic": { en: "HC-SR04 Ultrasonic Sensor", tags: "ultrasonic distance obstacle مسافة عوائق" },
  "DC motor": { en: "DC Motor", tags: "dc motor wheel car محرك سيارة" },
  "Servo motor": { en: "SG90 Servo Motor", tags: "servo motor محرك سيرفو" },
  "Keypad": { en: "Matrix Keypad", tags: "keypad input لوحة مفاتيح" },
  "Push button": { en: "Tactile Push Button", tags: "button push switch زر" },
  "2222 A": { en: "2N2222A NPN Transistor", tags: "transistor npn switch ترانزستور" },
  "BC516": { en: "BC516 PNP Darlington Transistor", tags: "transistor darlington ترانزستور" },
  "MCP 9700E": { en: "MCP9700 Temperature Sensor", tags: "temperature sensor حرارة" },
  "JC29 07A": { en: "2N2907A PNP Transistor", tags: "transistor pnp ترانزستور" },
  "مقاومة": { en: "Assorted Resistors", tags: "resistor مقاومة" },
  "مكثف كيميائي": { en: "Electrolytic Capacitor", tags: "capacitor electrolytic مكثف" },
  "مكثف سيراميك": { en: "Ceramic Capacitor", tags: "capacitor ceramic مكثف" },
  "7 segments dual": { en: "Dual 7-Segment Display", tags: "7 segment display عداد" },
  "LDR": { en: "Light-Dependent Resistor (LDR)", tags: "ldr light sensor ضوء" },
  "LD33CV": { en: "LD33CV 3.3V Voltage Regulator", tags: "regulator voltage power منظم جهد" },
  "L9110H": { en: "L9110H Motor Driver", tags: "motor driver h-bridge قيادة محركات" },
  "IR sensor": { en: "IR Obstacle Sensor", tags: "ir infrared obstacle line follower اشعة عوائق خط" },
};

function metaFor(name) {
  return catalogMeta[name] || null;
}

module.exports = { catalogMeta, metaFor };
