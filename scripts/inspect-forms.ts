import { PDFDocument } from 'pdf-lib'
import fs from 'fs'

async function inspectPdf(path: string, name: string) {
  const bytes = fs.readFileSync(path)
  const doc = await PDFDocument.load(bytes)
  const form = doc.getForm()
  
  console.log(`\n=== ${name} ===`)
  console.log(`Pages: ${doc.getPageCount()}`)
  console.log(`Form fields: ${form.getFields().length}`)
  
  for (const field of form.getFields()) {
    const type = field.constructor.name
    const name = field.getName()
    console.log(`  ${type}: ${name}`)
    
    if (field.constructor.name === 'PDFTextField') {
      const textField = field as any
      try {
        const value = textField.getText()
        if (value) console.log(`    Current value: ${value}`)
      } catch (_e) {
        // ignore
      }
    }
    
    if (field.constructor.name === 'PDFCheckBox') {
      const checkbox = field as any
      try {
        const value = checkbox.isChecked()
        console.log(`    Checked: ${value}`)
      } catch (_e) {
        // ignore
      }
    }
    
    if (field.constructor.name === 'PDFRadioGroup') {
      const radio = field as any
      try {
        const value = radio.getValue()
        console.log(`    Selected: ${value}`)
      } catch (_e) {
        // ignore
      }
    }
  }
}

inspectPdf('public/forms/i-9.pdf', 'I-9')
  .then(() => inspectPdf('public/forms/w4-2025.pdf', 'W-4'))
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
