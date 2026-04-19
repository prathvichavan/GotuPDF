"use client";

import { useState, useRef, DragEvent } from "react";
import CloudImport from "@/components/CloudImport";

interface DragDropUploadProps {
 onFileSelect: (files: File[]) => void;
 accept?: string;
 multiple?: boolean;
 maxSize?: number; // in MB
 disabled?: boolean;
 icon?: string;
 title?: string;
 subtitle?: string;
 borderColor?: string;
 hoverColor?: string;
}

export default function DragDropUpload({
 onFileSelect,
 accept = ".pdf",
 multiple = false,
 maxSize = 50,
 disabled = false,
 icon = "📄",
 title = "Click to select files",
 subtitle = "or drag and drop files here",
 borderColor = "border-purple-300",
 hoverColor = "border-purple-500 bg-purple-500/100/10",
}: DragDropUploadProps) {
 const [isDragging, setIsDragging] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const styleVars = {
 accent: "var(--accent-primary, #2563eb)",
 uploadBorder: "var(--upload-border, #d1d5db)",
 uploadBg: "var(--upload-bg, #ffffff)",
 uploadHoverBg: "var(--upload-hover-bg, #f9fafb)",
 textPrimary: "var(--text-primary, #111827)",
 textSecondary: "var(--text-secondary, #374151)",
 textMuted: "var(--text-muted, #9ca3af)",
 };

 const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
 e.preventDefault();
 e.stopPropagation();
 if (!disabled) {
 setIsDragging(true);
 }
 };

 const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
 e.preventDefault();
 e.stopPropagation();
 setIsDragging(false);
 };

 const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
 e.preventDefault();
 e.stopPropagation();
 };

 const handleDrop = (e: DragEvent<HTMLDivElement>) => {
 e.preventDefault();
 e.stopPropagation();
 setIsDragging(false);

 if (disabled) return;

 const files = Array.from(e.dataTransfer.files);
 handleFiles(files);
 };

 const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(e.target.files || []);
 handleFiles(files);
 };

 const handleFiles = (files: File[]) => {
 // Filter by file type
 const acceptedExtensions = accept.split(',').map(ext => ext.trim().toLowerCase());
 const validFiles = files.filter(file => {
 const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
 return acceptedExtensions.some(ext => ext === fileExtension || ext === '*');
 });

 // Filter by size
 const maxSizeBytes = maxSize * 1024 * 1024;
 const sizedFiles = validFiles.filter(file => file.size <= maxSizeBytes);

 if (sizedFiles.length < validFiles.length) {
 alert(`Some files exceed the maximum size of ${maxSize}MB and were not added.`);
 }

 if (validFiles.length < files.length) {
 alert(`Some files were not accepted. Please upload ${accept} files only.`);
 }

 if (sizedFiles.length > 0) {
 onFileSelect(multiple ? sizedFiles : [sizedFiles[0]]);
 }
 };

 const handleClick = () => {
 if (!disabled && fileInputRef.current) {
 fileInputRef.current.click();
 }
 };

 return (
 <div>
 <div
 className={`border-4 border-dashed rounded-xl p-12 text-center transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
 style={{
 borderColor: isDragging ? styleVars.accent : styleVars.uploadBorder,
 backgroundColor: isDragging ? styleVars.uploadHoverBg : styleVars.uploadBg,
 }}
 onDragEnter={handleDragEnter}
 onDragOver={handleDragOver}
 onDragLeave={handleDragLeave}
 onDrop={handleDrop}
 onClick={handleClick}
 onMouseEnter={(e) => {
 if (!disabled && !isDragging) {
 e.currentTarget.style.borderColor = styleVars.accent;
 e.currentTarget.style.backgroundColor = styleVars.uploadHoverBg;
 }
 }}
 onMouseLeave={(e) => {
 if (!disabled && !isDragging) {
 e.currentTarget.style.borderColor = styleVars.uploadBorder;
 e.currentTarget.style.backgroundColor = styleVars.uploadBg;
 }
 }}
 >
 <input
 ref={fileInputRef}
 type="file"
 accept={accept}
 multiple={multiple}
 onChange={handleFileInputChange}
 className="hidden"
 disabled={disabled}
 />
 <div className="text-6xl mb-4">{icon}</div>
 <div className="text-xl font-semibold mb-2" style={{ color: styleVars.textPrimary }}>
 {title}
 </div>
 <div className="text-base" style={{ color: styleVars.textSecondary }}>
 {subtitle}
 </div>
 <div className="text-sm mt-2" style={{ color: styleVars.textMuted }}>
 Maximum file size: {maxSize}MB
 </div>
 </div>
 <CloudImport
 onFilesSelected={onFileSelect}
 accept={accept}
 maxSizeBytes={maxSize * 1024 * 1024}
 multiple={multiple}
 disabled={disabled}
 />
 </div>
 );
}