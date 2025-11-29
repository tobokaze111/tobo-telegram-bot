# QR Code Setup Instructions

## How to Add Your Payment QR Code

1. **Save your QR code image** as `qr-code.png`
2. **Place it in this folder**: `src/assets/qr-code.png`
3. **Create the assets folder** if it doesn't exist:
   ```
   src/
     assets/
       qr-code.png  <-- Put your QR code here
   ```

## Supported Formats
- PNG (recommended)
- JPG/JPEG
- The bot will automatically display it when users tap "Add Funds"

## If QR Code is Not Found
- The bot will still work, but users won't see the QR code image
- They can still submit payment details manually

