"use client";

import { useRef, useState } from "react";
import { FolderOpen, Image as ImageIcon, X } from "lucide-react";

export function ImageFilePicker({
  label,
  disabled,
  onChoose,
}: {
  label: string;
  disabled?: boolean;
  onChoose: (file: File) => Promise<void>;
}) {
  const [filename, setFilename] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const uploading = useRef(false);

  async function upload(file: File) {
    if (disabled || uploading.current) return;
    uploading.current = true;
    setFilename(file.name);
    setStatus("Uploading image…");
    setError("");
    try {
      await onChoose(file);
      setStatus("Image uploaded.");
    } catch (error) {
      setStatus("");
      setError(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      uploading.current = false;
      setFilename("");
    }
  }

  return (
    <div className="image-picker">
      <label className="image-file-picker">
        <input
          className="sr-only"
          aria-label={label}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || Boolean(filename)}
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            input.value = "";
            void upload(file);
          }}
        />
        <span className="image-file-picker-action">
          <FolderOpen size={17} aria-hidden="true" />
          Choose file
        </span>
        <span className="image-file-picker-name" title={filename}>
          {filename || "PNG, JPEG or WebP"}
        </span>
      </label>
      <div className="image-upload-feedback">
        <span role="status">{status}</span>
        {error && <span className="image-upload-error" role="alert">{error}</span>}
      </div>
    </div>
  );
}

export function ImageAttachment({
  label,
  src,
  disabled,
  editable,
  onUpload,
  onRemove,
}: {
  label: string;
  src?: string;
  disabled: boolean;
  editable: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
}) {
  return (
    <div className="image-attachment" role="group" aria-label={label}>
      <div className="image-attachment-preview">
        {src ? (
          <img src={src} alt="" loading="lazy" />
        ) : (
          <span className="image-attachment-placeholder">
            <ImageIcon size={21} aria-hidden="true" />
          </span>
        )}
        <div>
          <strong>{label}</strong>
          <small>{src ? "Image attached" : "No image attached"}</small>
        </div>
        {src && editable && (
          <button type="button" className="image-remove" disabled={disabled} onClick={onRemove}>
            <X size={15} aria-hidden="true" />
            Remove image
          </button>
        )}
      </div>
      {editable && (
        <ImageFilePicker
          label={`Choose ${label.toLowerCase()} file`}
          disabled={disabled}
          onChoose={onUpload}
        />
      )}
    </div>
  );
}
