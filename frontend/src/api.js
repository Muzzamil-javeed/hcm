import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("flowhcm_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function openAnnouncementPdf(id) {
  const { data } = await api.get(`/dashboard/announcements/${id}/document`);
  const file = await fetch(data.data);
  const blob = await file.blob();
  const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  window.open(url, "_blank", "noopener");
}

export default api;
