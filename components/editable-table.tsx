"use client"
import { useSpreadsheetStore } from "@/store/spreadsheet-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, GripVertical, Plus } from "lucide-react"

export function EditableTable() {
  const { keys, columns, actions } = useSpreadsheetStore((state) => ({
    keys: state.keys,
    columns: state.columns,
    actions: state.actions,
  }))

  const handleKeyNameChange = (keyId: string, newName: string) => {
    actions.updateKeyName(keyId, newName)
  }

  const handleCellValueChange = (columnId: string, keyId: string, newValue: string) => {
    actions.updateCellValue(columnId, keyId, newValue)
  }

  const handleAddKey = () => {
    actions.addKey("New Property")
  }

  const handleDeleteKey = (keyId: string) => {
    actions.deleteKey(keyId)
  }

  if (keys.length === 0 && columns.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Upload an image to start building your table.</p>
        <p className="text-sm">
          Keys (row headers) will be generated from the first image, or you can add them manually once data appears.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto p-4">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px] min-w-[150px] sticky left-0 bg-background z-10">Property</TableHead>
            {columns.map((col) => (
              <TableHead key={col.id} className="min-w-[150px] whitespace-nowrap">
                {col.fileName}
              </TableHead>
            ))}
            {columns.length === 0 && keys.length > 0 && <TableHead className="min-w-[150px]">Image Data</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key.id}>
              <TableCell className="font-medium sticky left-0 bg-background z-10 flex items-center group">
                <GripVertical className="h-4 w-4 mr-1 text-muted-foreground/50 cursor-grab" />
                <Input
                  type="text"
                  value={key.name}
                  onChange={(e) => handleKeyNameChange(key.id, e.target.value)}
                  className="h-8 border-0 focus-visible:ring-1 focus-visible:ring-primary px-1"
                  aria-label={`Edit key name ${key.name}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-1 opacity-0 group-hover:opacity-100"
                  onClick={() => handleDeleteKey(key.id)}
                  aria-label={`Delete key ${key.name}`}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </TableCell>
              {columns.map((col) => (
                <TableCell key={col.id}>
                  <Input
                    type="text"
                    value={actions.getCellValue(col.id, key.id)}
                    onChange={(e) => handleCellValueChange(col.id, key.id, e.target.value)}
                    className="h-8 border-0 focus-visible:ring-1 focus-visible:ring-primary px-1"
                    aria-label={`Edit value for ${key.name} in column ${col.fileName}`}
                  />
                </TableCell>
              ))}
              {columns.length === 0 && (
                <TableCell className="text-muted-foreground italic">No image data yet</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 sticky left-0">
        <Button variant="outline" size="sm" onClick={handleAddKey}>
          <Plus className="h-4 w-4 mr-2" /> Add Property (Row)
        </Button>
      </div>
    </div>
  )
}
