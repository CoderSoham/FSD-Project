import axios from "axios";
import { logout } from "./shared/utils/auth";
import { API_BASE } from "./config";

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

apiClient.interceptors.request.use(
  (config) => {
    const userDetails = localStorage.getItem("user");

    if (userDetails) {
      const token = JSON.parse(userDetails).token;
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (err) => {
    return Promise.reject(err);
  }
);

// API Call Functions
export const login = async (data) => {
  try {
    return await apiClient.post("/auth/login", data);
  } catch (exception) {
    return {
      error: true,
      exception,
    };
  }
};

export const register = async (data) => {
  try {
    return await apiClient.post("/auth/register", data);
  } catch (exception) {
    return {
      error: true,
      exception,
    };
  }
};

export const sendFriendInvitation = async (data) => {
  try {
    return await apiClient.post("/friend-invitation/invite", data);
  } catch (exception) {
    checkResponseCode(exception);
    return {
      error: true,
      exception,
    };
  }
};

export const acceptFriendInvitation = async (data) => {
  try {
    return await apiClient.post("/friend-invitation/accept", data);
  } catch (exception) {
    checkResponseCode(exception);
    return {
      error: true,
      exception,
    };
  }
};

export const rejectFriendInvitation = async (data) => {
  try {
    return await apiClient.post("/friend-invitation/reject", data);
  } catch (exception) {
    checkResponseCode(exception);
    return {
      error: true,
      exception,
    };
  }
};

export const uploadFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    return await apiClient.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  } catch (exception) {
    return {
      error: true,
      exception,
    };
  }
};

export const getRoomMessages = async (roomId) => {
  try {
    const res = await apiClient.get(`/files/room/${roomId}/messages`);
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.error || 'Failed to fetch messages' };
  }
};

export const postRoomMessage = async (roomId, message) => {
  try {
    const res = await apiClient.post(`/files/room/${roomId}/messages`, message);
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.error || 'Failed to send message' };
  }
};

export const saveCodeVersion = async (data) => {
  try {
    const res = await apiClient.post('/code/save', data);
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.error || 'Failed to save version' };
  }
};

export const getCodeHistory = async (filename, params = {}) => {
  try {
    const res = await apiClient.get(`/code/history/${encodeURIComponent(filename)}`, { params });
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.error || 'Failed to fetch history' };
  }
};

export const getCodeVersion = async (versionId) => {
  try {
    const res = await apiClient.get(`/code/version/${versionId}`);
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.error || 'Failed to fetch version' };
  }
};

export const createBranch = async (data) => {
  try {
    const res = await apiClient.post('/code/branch', data);
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.error || 'Failed to create branch' };
  }
};

export const getBranches = async (filename) => {
  try {
    const res = await apiClient.get(`/code/branches/${encodeURIComponent(filename)}`);
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.error || 'Failed to fetch branches' };
  }
};

export const mergeBranches = async (data) => {
  try {
    const res = await apiClient.post('/code/merge', data);
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.error || 'Failed to merge branches' };
  }
};

export const addCodeComment = async (data) => {
  try {
    const res = await apiClient.post('/code/comments', data);
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.error || 'Failed to add comment' };
  }
};

export const getCodeComments = async (params) => {
  try {
    const res = await apiClient.get('/code/comments', { params });
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.error || 'Failed to fetch comments' };
  }
};

export const deleteCodeComment = async (id) => {
  try {
    const res = await apiClient.delete(`/code/comments/${id}`);
    return res.data;
  } catch (e) {
    return { error: true, message: e.response?.data?.error || 'Failed to delete comment' };
  }
};

const checkResponseCode = (exception) => {
  const responseCode = exception?.response?.status;

  if (responseCode) {
    (responseCode === 401 || responseCode === 403) && logout();
  }
};

/**
 * Fetch a shared file through the authenticated download route.
 *
 * A plain <a href> cannot be used: the route requires an Authorization header
 * and a link sends none. So the blob is fetched through the same axios client
 * that carries the token, then handed to the browser as a save.
 */
export const downloadRoomFile = async (fileId, filename) => {
  try {
    const res = await apiClient.get(`/files/${fileId}/download`, { responseType: "blob" });
    const href = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(href);
    return { ok: true };
  } catch (err) {
    return { error: err?.response?.status === 404
      ? "File not found, or you do not have access to it."
      : "Download failed." };
  }
};

export const setVersionCitable = async (versionId, citable) => {
  try {
    const res = await apiClient.post(`/code/version/${versionId}/cite`, { citable });
    return res.data;
  } catch (e) {
    return { error: e?.response?.data?.error || "Could not update citation status." };
  }
};

export const getCitation = async (versionId) => {
  try {
    const res = await apiClient.get(`/code/version/${versionId}/citation`);
    return res.data;
  } catch (e) {
    return { error: "Could not load the citation." };
  }
};

/**
 * A published version, fetched without authentication.
 *
 * Bypasses `apiClient` deliberately: that instance attaches the stored token
 * and logs the user out on a 401, neither of which should happen to a visitor
 * following a citation who has no account at all.
 */
export const getPublicVersion = async (versionId) => {
  try {
    const res = await fetch(`${API_BASE}/public/versions/${versionId}`);
    if (!res.ok) return { error: "not-available" };
    return await res.json();
  } catch {
    return { error: "not-available" };
  }
};

/** Download a document's full history as a git fast-import stream. */
export const exportHistory = async (filename) => {
  try {
    const res = await apiClient.get(`/code/export/${encodeURIComponent(filename)}`,
      { responseType: "blob" });
    const href = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${filename.replace(/[^\w.-]+/g, "_")}.fast-import`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(href);
    return { ok: true };
  } catch (e) {
    return { error: "Could not export the history." };
  }
};
