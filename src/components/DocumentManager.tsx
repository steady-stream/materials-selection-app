import { useEffect, useState } from "react";
import { projectService } from "../services";

interface DocumentManagerProps {
  projectId: string;
  sharepointFolderId?: string;
  sharepointDriveId?: string;
}

interface SharePointFile {
  id: string;
  name: string;
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  webUrl?: string;
  "@microsoft.graph.downloadUrl"?: string;
  folder?: any;
  file?: any;
}

export default function DocumentManager({
  projectId,
  sharepointFolderId,
  sharepointDriveId,
}: DocumentManagerProps) {
  const [files, setFiles] = useState<SharePointFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  useEffect(() => {
    if (sharepointFolderId && sharepointDriveId) {
      loadFiles();
    }
  }, [projectId, sharepointFolderId, sharepointDriveId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await projectService.getFiles(projectId);
      setFiles(response.files || []);
    } catch (err: any) {
      console.error("Error loading files:", err);
      setError(err.message || "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  if (!sharepointFolderId || !sharepointDriveId) {
    return null;
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString();
  };

  const getFileIcon = (file: SharePointFile) => {
    if (file.folder) return "📁";

    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return "📄";
    if (name.match(/\.(jpg|jpeg|png|gif|bmp)$/)) return "🖼️";
    if (name.match(/\.(xls|xlsx)$/)) return "📊";
    if (name.match(/\.(doc|docx)$/)) return "📝";
    if (name.match(/\.(zip|rar|7z)$/)) return "🗜️";
    return "📎";
  };

  const hasDownloadUrl = (file: SharePointFile) => {
    return !!file["@microsoft.graph.downloadUrl"];
  };

  const isOfficeFile = (fileName: string) => {
    const name = fileName.toLowerCase();
    return (
      name.match(/\.(doc|docx)$/) ||
      name.match(/\.(xls|xlsx)$/) ||
      name.match(/\.(ppt|pptx)$/)
    );
  };

  const getOfficeProtocolUrl = (file: SharePointFile) => {
    if (!file.webUrl) return null;

    const name = file.name.toLowerCase();
    let protocol = "";

    if (name.match(/\.(doc|docx)$/)) protocol = "ms-word:ofe|u|";
    else if (name.match(/\.(xls|xlsx)$/)) protocol = "ms-excel:ofe|u|";
    else if (name.match(/\.(ppt|pptx)$/)) protocol = "ms-powerpoint:ofe|u|";

    // URL encode the SharePoint URL for proper protocol handling
    return protocol ? protocol + encodeURIComponent(file.webUrl) : null;
  };

  // API Gateway + Lambda sync payload cap: ~6MB total; base64 adds ~33% overhead → 4MB original file limit
  const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

  const handleFileUpload = async (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum upload size is 4 MB. For larger files, upload directly to SharePoint.`,
      );
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          // Remove data URL prefix (e.g., "data:text/plain;base64,")
          const base64Content = base64.split(",")[1];
          resolve(base64Content);
        };
        reader.onerror = reject;
      });

      reader.readAsDataURL(file);
      const base64Content = await base64Promise;

      // Upload to API
      await projectService.uploadFile(projectId, file.name, base64Content);

      // Reload files list
      await loadFiles();
    } catch (err: any) {
      console.error("Error uploading file:", err);
      setError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFileUpload(selectedFiles[0]);
    }
    // Reset input so same file can be uploaded again
    e.target.value = "";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFileUpload(droppedFiles[0]);
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!window.confirm(`Delete ${fileName}?`)) {
      return;
    }

    setDeletingFileId(fileId);
    setError(null);

    try {
      await projectService.deleteFile(projectId, fileId);
      await loadFiles(); // Reload the file list
    } catch (err) {
      console.error("Error deleting file:", err);
      setError("Failed to delete file");
    } finally {
      setDeletingFileId(null);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden mb-4">
      <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-600 hover:text-gray-900"
          >
            {isExpanded ? "▼" : "▶"}
          </button>
          <h3 className="text-sm font-semibold text-gray-700">Documents</h3>
          <span className="text-xs text-gray-500">
            {uploading
              ? "Uploading..."
              : loading
                ? "Loading..."
                : `${files.length} file${files.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileInputChange}
            disabled={uploading || loading}
          />
          <label
            htmlFor="file-upload"
            className={`text-xs px-2 py-1 rounded cursor-pointer ${
              uploading || loading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {uploading ? "Uploading..." : "+ Upload"}
          </label>
        </div>
      </div>

      {isExpanded && (
        <div
          className={`bg-white ${
            dragActive
              ? "bg-blue-50 border-2 border-blue-400 border-dashed"
              : ""
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {loading && (
            <div className="text-center py-4 text-xs text-gray-500">
              Loading files...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-xs">
              {error}
            </div>
          )}

          {!loading && !error && files.length === 0 && (
            <div className="text-center py-4 text-xs text-gray-500">
              {dragActive ? (
                <p className="text-blue-600 font-medium">Drop file to upload</p>
              ) : (
                <p>No files yet - click Upload or drag & drop</p>
              )}
            </div>
          )}

          {!loading && !error && files.length > 0 && (
            <div>
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm">{getFileIcon(file)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      {!file.folder && (
                        <div className="flex gap-2 text-xs text-gray-500">
                          <span>{formatFileSize(file.size)}</span>
                          {file.lastModifiedDateTime && (
                            <span>
                              • {formatDate(file.lastModifiedDateTime)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {file.webUrl && !file.folder && (
                    <>
                      <a
                        href={file.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                      {hasDownloadUrl(file) && (
                        <a
                          href={file["@microsoft.graph.downloadUrl"]}
                          download={file.name}
                          className="ml-2 text-xs text-green-600 hover:text-green-800"
                          title="Download file"
                        >
                          ⬇ Download
                        </a>
                      )}
                      {isOfficeFile(file.name) &&
                        getOfficeProtocolUrl(file) && (
                          <a
                            href={getOfficeProtocolUrl(file)!}
                            className="ml-2 text-xs text-purple-600 hover:text-purple-800"
                            title="Open in desktop app (may require security settings)"
                          >
                            📱 Desktop
                          </a>
                        )}
                      <button
                        onClick={() => handleDeleteFile(file.id, file.name)}
                        disabled={
                          uploading || loading || deletingFileId === file.id
                        }
                        className="ml-2 text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        title="Delete file"
                      >
                        {deletingFileId === file.id ? "..." : "🗑️"}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
