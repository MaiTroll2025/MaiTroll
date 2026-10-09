import { PDFDocument } from 'pdf-lib'
import fs from 'fs'

async function inspectW4Fields() {
  const bytes = fs.readFileSync('public/forms/w4-2025.pdf')
  const doc = await PDFDocument.load(bytes)
  const form = doc.getForm()
  
  console.log('=== W-4 Fields ===')
  for (const field of form.getFields()) {
    const type = field.constructor.name
    const name = field.getName()
    console.log(`${type}: ${name}`)
    
    if (type === 'PDFTextField') {
      const textField = field as any
      try {
        const value = textField.getText()
        if (value) console.log(`  Value: ${value}`)
      } catch (_e) {}
    }
    
    if (type === 'PDFCheckBox') {
      const checkbox = field as any
      try {
        console.log(`  Checked: ${checkbox.isChecked()}`)
      } catch (_e) {}
    }
  }
}

inspectW4Fields().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
