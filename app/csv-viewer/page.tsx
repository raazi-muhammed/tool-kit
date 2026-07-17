"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ColumnDeleteIcon,
  ColumnInsertIcon,
  Csv01Icon,
  Eraser01Icon,
  RowDeleteIcon,
  RowInsertIcon,
  Table01Icon,
  TextIcon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { useMemo, useRef, useState } from "react"

import { ToolPage } from "@/components/tool-page"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { columnLabel, parseCsv, serializeCsv } from "@/lib/csv"
import { downloadFile } from "@/lib/download"
import { cn, readFirstFileAsText } from "@/lib/utils"

type Tab = "text" | "table"

const DEFAULT_FILE_NAME = "data.csv"

// Table view renders an <input> per cell, so very large files are capped to
// keep typing responsive — the Text view still holds (and downloads) the
// whole file.
const MAX_TABLE_ROWS = 500

export default function CsvViewerPage() {
  const [raw, setRaw] = useState("")
  const [tab, setTab] = useState<Tab>("text")
  const [headerRow, setHeaderRow] = useState(true)
  const [fileName, setFileName] = useState(DEFAULT_FILE_NAME)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const rows = useMemo(() => parseCsv(raw), [raw])
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const dataRowCount =
    headerRow && rows.length > 0 ? rows.length - 1 : rows.length
  const visibleRows = rows.slice(0, MAX_TABLE_ROWS)

  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    const text = await readFirstFileAsText(files)
    if (text == null) return
    setRaw(text)
    setTab("table")
    if (file) setFileName(file.name)
  }

  function updateCell(rowIndex: number, colIndex: number, value: string) {
    const next = rows.map((row) => [...row])
    while (next[rowIndex].length <= colIndex) next[rowIndex].push("")
    next[rowIndex][colIndex] = value
    setRaw(serializeCsv(next))
  }

  function addRow() {
    // A lone empty row can't survive a CSV round-trip (it serializes to an
    // empty line), so new rows are at least two columns wide.
    const width = Math.max(columnCount, 2)
    setRaw(serializeCsv([...rows, Array<string>(width).fill("")]))
  }

  function addColumn() {
    if (rows.length === 0) {
      addRow()
      return
    }
    setRaw(
      serializeCsv(
        rows.map((row) => {
          const next = [...row]
          while (next.length < columnCount + 1) next.push("")
          return next
        })
      )
    )
  }

  function deleteRow(rowIndex: number) {
    setRaw(serializeCsv(rows.filter((_, index) => index !== rowIndex)))
  }

  function deleteColumn(colIndex: number) {
    setRaw(
      serializeCsv(
        rows.map((row) => row.filter((_, index) => index !== colIndex))
      )
    )
  }

  function clear() {
    setRaw("")
    setFileName(DEFAULT_FILE_NAME)
  }

  function download() {
    const blob = new Blob([raw], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    downloadFile(url, fileName)
    URL.revokeObjectURL(url)
  }

  return (
    <ToolPage
      page="CSV Viewer"
      icon={Csv01Icon}
      onAddFile={dropzoneRef}
      segments={{
        value: tab,
        onValueChange: (value) => setTab(value as Tab),
        label: "View",
        options: [
          { value: "text", label: "Text", icon: TextIcon },
          { value: "table", label: "Table", icon: Table01Icon },
        ],
      }}
      sidebar={{
        toggle: {
          label: "First row is header",
          pressed: headerRow,
          onPressedChange: setHeaderRow,
        },
        hint:
          rows.length > 0
            ? `${dataRowCount} ${dataRowCount === 1 ? "row" : "rows"} · ${columnCount} ${columnCount === 1 ? "column" : "columns"}`
            : undefined,
        actions: [
          {
            actions: [
              {
                label: "Add row",
                icon: RowInsertIcon,
                onClick: addRow,
                variant: "secondary",
              },
              {
                label: "Add column",
                icon: ColumnInsertIcon,
                onClick: addColumn,
                variant: "secondary",
              },
            ],
          },
          {
            label: "Clear",
            icon: Eraser01Icon,
            onClick: clear,
            variant: "outline",
          },
        ],
        download: { onDownload: download, disabled: !raw.trim() },
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {tab === "text" ? (
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste CSV here (your data is not saved anywhere)"
            variant="flat"
            className="field-sizing-fixed min-h-[60vh] flex-1 overflow-y-auto rounded-lg border border-border bg-card/40 p-4 font-mono text-xs"
            spellCheck={false}
          />
        ) : (
          <Card className="flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-lg border bg-card/40 p-0 ring-0">
            {rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Paste CSV in the Text view or add a file to see it as a table.
              </p>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-separate border-spacing-0 font-mono text-xs">
                  <thead>
                    <tr>
                      <th className="sticky top-0 z-10 w-10 border-r border-b bg-muted px-2 py-1.5" />
                      {Array.from({ length: columnCount }, (_, c) => (
                        <th
                          key={c}
                          className="group sticky top-0 z-10 border-r border-b bg-muted px-2 py-1.5 text-left font-normal"
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span className="text-muted-foreground select-none">
                              {columnLabel(c)}
                            </span>
                            <button
                              type="button"
                              onClick={() => deleteColumn(c)}
                              aria-label={`Delete column ${columnLabel(c)}`}
                              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              <HugeiconsIcon
                                icon={ColumnDeleteIcon}
                                className="size-3.5"
                                aria-hidden
                              />
                            </button>
                          </span>
                        </th>
                      ))}
                      <th className="sticky top-0 z-10 w-8 border-b bg-muted" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, r) => {
                      const isHeader = headerRow && r === 0
                      const rowNumber = headerRow ? r : r + 1
                      return (
                        <tr key={r} className="group">
                          <td className="border-r border-b bg-muted/50 px-2 py-1.5 text-right text-muted-foreground select-none">
                            {isHeader ? "" : rowNumber}
                          </td>
                          {Array.from({ length: columnCount }, (_, c) => (
                            <td key={c} className="border-r border-b p-0">
                              <input
                                value={row[c] ?? ""}
                                onChange={(e) =>
                                  updateCell(r, c, e.target.value)
                                }
                                aria-label={
                                  isHeader
                                    ? `Header ${columnLabel(c)}`
                                    : `Cell ${columnLabel(c)}${rowNumber}`
                                }
                                spellCheck={false}
                                className={cn(
                                  "w-full min-w-28 bg-transparent px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                                  isHeader && "font-semibold"
                                )}
                              />
                            </td>
                          ))}
                          <td className="border-b px-1 text-center">
                            <button
                              type="button"
                              onClick={() => deleteRow(r)}
                              aria-label={
                                isHeader
                                  ? "Delete header row"
                                  : `Delete row ${rowNumber}`
                              }
                              className="rounded p-0.5 align-middle text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              <HugeiconsIcon
                                icon={RowDeleteIcon}
                                className="size-3.5"
                                aria-hidden
                              />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {rows.length > MAX_TABLE_ROWS && (
                  <p className="p-3 text-xs text-muted-foreground">
                    Showing the first {MAX_TABLE_ROWS} of {rows.length} rows —
                    edit the rest in the Text view.
                  </p>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      <Dropzone
        ref={dropzoneRef}
        hidden
        icon={Upload04Icon}
        title="Drag and drop a CSV file to upload"
        description="or, click to browse · your file is not saved anywhere"
        accept=".csv,text/csv"
        onFiles={handleFiles}
      />
    </ToolPage>
  )
}
