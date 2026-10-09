# Aevora — Character & Pet Selection Update

แพ็กเกจนี้ต่อยอดจาก `aevora-main.zip` ที่ได้รับ พร้อมเพิ่มหน้าเลือกตัวละครและสัตว์เลี้ยง

## สิ่งที่เพิ่ม
- ตัวละครหญิง: `g1.png` ถึง `g7.png`
- ตัวละครชาย: `b1.png` ถึง `b5.png`
- แท็บเลือกเพศ และการ์ดตัวละครที่กดเลือกได้
- สัตว์เลี้ยง 8 แบบ (ไอคอนอีโมจิ; แมวพระจันทร์ใช้รูป `pet-cat.png`)
- รูป `character-decoration.png` ใช้เป็นของตกแต่งหน้า ไม่ใช่ตัวละครที่เลือก
- บันทึกตัวละครและสัตว์เลี้ยงใน `localStorage`
- เพิ่มสไตล์การ์ดพาสเทลและแสดงตัวละครที่เลือกในหน้า “ตัวละคร” และพื้นที่ส่วนตัว

## ตำแหน่งรูป
- `public/images/characters/g1.png` ... `g7.png`
- `public/images/characters/b1.png` ... `b5.png`
- `public/images/pets/pet-cat.png`
- `public/images/pets/pet-paw.png`
- `public/images/decorations/character-decoration.png`

## ทดสอบ
ต้องติดตั้ง dependencies ก่อน:
```bash
npm ci
npm run build
```

หมายเหตุ: ในสภาพแวดล้อมที่จัดทำไฟล์นี้ การติดตั้ง dependencies ไม่สมบูรณ์ จึงยังยืนยันไม่ได้ว่า `npm run build` ผ่าน กรุณาทดสอบ build ก่อน deploy จริง

## นำไปใช้กับ Repository เดิม
ไฟล์หลักที่เปลี่ยน:
- `src/App.tsx`
- `src/App.css`

เพิ่มโฟลเดอร์รูป:
- `public/images/characters/`
- `public/images/pets/`
- `public/images/decorations/`

หากนำเฉพาะแพตช์ไปใส่ใน repository เดิม ต้องอัปโหลดทั้งไฟล์โค้ดและโฟลเดอร์รูปตามเส้นทางเดิม เพื่อไม่ให้รูปหาย
