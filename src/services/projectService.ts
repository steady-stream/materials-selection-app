import type {
    CreateProjectRequest,
    Project,
    ProjectShareCreated,
    ProjectShareStatus,
    ReviewData,
    UpdateProjectRequest,
} from "../types";
import apiClient from "./api";

// Local type for SharePoint folder entries returned by the folder-browser endpoint
interface SharepointFolder {
  id: string;
  name: string;
  webUrl: string;
  driveId: string;
  siteId: string;
}

export const projectService = {
  // Get all projects
  getAll: async (): Promise<Project[]> => {
    const response = await apiClient.get<{ projects: Project[] } | Project[]>(
      "/projects",
    );
    // Handle both { projects: [...] } shape and raw array (defensive fallback)
    if (Array.isArray(response.data)) return response.data;
    return response.data.projects ?? [];
  },

  // Get a single project by ID
  getById: async (id: string): Promise<Project> => {
    const response = await apiClient.get<Project>(`/projects/${id}`);
    return response.data;
  },

  // Create a new project
  create: async (data: CreateProjectRequest): Promise<Project> => {
    const response = await apiClient.post<Project>("/projects", data);
    return response.data;
  },

  // Update an existing project
  update: async (id: string, data: UpdateProjectRequest): Promise<Project> => {
    const response = await apiClient.put<Project>(`/projects/${id}`, data);
    return response.data;
  },

  // Delete a project
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },

  // Get project files from SharePoint
  getFiles: async (id: string): Promise<{ files: any[] }> => {
    const response = await apiClient.get<{ files: any[] }>(
      `/projects/${id}/files`,
    );
    return response.data;
  },

  // Upload file to project SharePoint folder
  uploadFile: async (
    id: string,
    fileName: string,
    fileContent: string,
  ): Promise<any> => {
    const response = await apiClient.post(`/projects/${id}/files/upload`, {
      fileName,
      fileContent,
    });
    return response.data;
  },
  // Delete file from project SharePoint folder
  deleteFile: async (id: string, fileId: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}/files/${fileId}`);
  },

  // List available folders in the SharePoint base folder, or any subfolder by ID
  listSharepointFolders: async (
    id: string,
    options?: { folderId?: string; driveId?: string; siteId?: string },
  ): Promise<{
    folders: SharepointFolder[];
    driveId: string;
    siteId: string;
    currentFolderId: string;
  }> => {
    const params = options?.folderId
      ? `?folderId=${encodeURIComponent(options.folderId)}&driveId=${encodeURIComponent(options.driveId ?? "")}&siteId=${encodeURIComponent(options.siteId ?? "")}`
      : "";
    const response = await apiClient.get<{
      folders: SharepointFolder[];
      driveId: string;
      siteId: string;
      currentFolderId: string;
    }>(`/projects/${id}/sharepoint/folders${params}`);
    return response.data;
  },

  // Create a subfolder inside any existing SharePoint folder (does NOT link to project)
  createSharepointFolder: async (
    id: string,
    data: {
      parentFolderId: string;
      driveId: string;
      siteId: string;
      folderName: string;
    },
  ): Promise<SharepointFolder> => {
    const response = await apiClient.post<{ folder: SharepointFolder }>(
      `/projects/${id}/sharepoint/folders`,
      data,
    );
    return response.data.folder;
  },

  // Link an existing or newly created SharePoint folder to the project
  linkSharepointFolder: async (
    id: string,
    data:
      | {
          folderId: string;
          folderName: string;
          driveId: string;
          siteId: string;
          folderUrl: string;
        }
      | { createNew: true; folderName: string },
  ): Promise<Project> => {
    const response = await apiClient.post<Project>(
      `/projects/${id}/sharepoint/link`,
      data,
    );
    return response.data;
  },

  // Get the non-secret SharePoint configuration from this Lambda environment
  getSharepointConfig: async (): Promise<{
    configured: boolean;
    siteUrl: string | null;
    library: string;
    baseFolder: string;
  }> => {
    const response = await apiClient.get("/sharepoint/config");
    return response.data as {
      configured: boolean;
      siteUrl: string | null;
      library: string;
      baseFolder: string;
    };
  },

  // -------------------------------------------------------------------------
  // Share / review link management
  // -------------------------------------------------------------------------

  // Create (or return existing) share link for a project.
  // Returns pin only on first-time creation — never again after that.
  createShare: async (projectId: string): Promise<ProjectShareCreated> => {
    const response = await apiClient.post<ProjectShareCreated>(
      `/projects/${projectId}/share`,
    );
    return response.data;
  },

  // Check whether an active share link exists for a project.
  getShareStatus: async (projectId: string): Promise<ProjectShareStatus> => {
    const response = await apiClient.get<ProjectShareStatus>(
      `/projects/${projectId}/share`,
    );
    return response.data;
  },

  // Revoke (delete) the share link for a project.
  revokeShare: async (projectId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/share`);
  },

  // Fetch review data for a share token (public, PIN required).
  // Called from the ReviewPage — no auth header needed.
  getReviewData: async (token: string, pin: string): Promise<ReviewData> => {
    const response = await apiClient.get<ReviewData>(
      `/review/${token}`,
      { params: { pin } },
    );
    return response.data;
  },
};
