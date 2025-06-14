# img2excel - AI-Powered Image to Spreadsheet Converter

**Never Manually Type Data Again.** Turn any image with data into an editable spreadsheet instantly using AI.

## Features

- 🤖 **AI-Powered**: Uses [Upstage AI](https://console.upstage.ai/docs/capabilities/information-extraction/universal-information-extraction) for intelligent schema generation and data extraction
- 📸 **Smart Schema Detection**: Automatically detects data structure from your first image
- 🔄 **Adaptive Extraction**: Uses your custom column headers as schema for subsequent images
- 📊 **Real-time Editing**: Edit extracted data in a spreadsheet interface
- 💾 **CSV Export**: Download your data as CSV files
- 🎯 **Multiple Formats**: Supports receipts, tables, invoices, lists, and more

## How It Works

1. **Upload First Image**: AI automatically generates a schema based on the data it detects
2. **Edit Column Headers**: Customize the column names to match your needs
3. **Add More Images**: AI extracts data using your custom schema
4. **Export**: Download as CSV when ready

## Setup

### Prerequisites

- Node.js 18+ and npm/pnpm
- [Upstage AI API Key](https://console.upstage.ai/)

### Installation

1. **Clone and Install**:
   ```bash
   git clone <your-repo>
   cd 93-image2excep
   npm install --legacy-peer-deps
   ```

2. **Configure API Key**:
   Create `.env.local` in the root directory:
   ```env
   UPSTAGE_API_KEY=your_upstage_api_key_here
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Open Application**:
   Visit `http://localhost:3000` (or the port shown in terminal)

## API Integration

The app uses two Upstage AI endpoints:

### Schema Generation
```bash
POST https://api.upstage.ai/v1/information-extraction/schema-generation
```
- **Purpose**: Automatically detect data structure from the first image
- **Input**: Image (base64)
- **Output**: JSON schema with detected fields

### Information Extraction
```bash
POST https://api.upstage.ai/v1/information-extraction
```
- **Purpose**: Extract data using predefined schema
- **Input**: Image + Schema (from column headers)
- **Output**: Extracted key-value pairs

## Usage Examples

### Receipt Processing
1. Upload a receipt image
2. AI detects: "Item Name", "Price", "Category"
3. Add more receipts - they follow the same schema
4. Export to CSV for expense tracking

### Invoice Processing
1. Upload an invoice
2. AI detects: "Description", "Quantity", "Unit Price", "Total"
3. Process multiple invoices consistently
4. Export for accounting

### Table Digitization
1. Upload a photo of a table/list
2. AI detects column structure
3. Add similar tables with consistent extraction
4. Export structured data

## Tech Stack

- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **AI Service**: Upstage AI Universal Information Extraction
- **TypeScript**: Full type safety

## Development

### Project Structure
```
├── app/
│   ├── api/                 # Upstage AI API routes
│   ├── editor/             # Spreadsheet editor page
│   └── page.tsx            # Landing page
├── components/             # React components
├── lib/                   # Utility functions
├── store/                 # Zustand store
└── styles/               # CSS styles
```

### Key Components
- **ImageUploader**: Drag & drop image upload
- **SpreadsheetStore**: State management for data
- **UpstageService**: AI API integration
- **EditableTable**: Dynamic spreadsheet interface

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `UPSTAGE_API_KEY` | Your Upstage AI API key | ✅ |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use for personal or commercial projects.

---

**Powered by AI & Vercel** | Built with ❤️ for productivity 