import api from "./api";

export interface PenData {
  title: string;
  description?: string;
  html: string;
  css: string;
  js: string;
  isPublic?: boolean;
  cssLanguage?: "css" | "scss" | "less";
  jsLanguage?: "js" | "ts" | "vue" | "react";
  importedCssPenIds?: string[];
  importedJsPenIds?: string[];
}

export interface Pen {
  id: string;
  title: string;
  description?: string;
  html: string;
  css: string;
  js: string;
  isPublic: boolean;
  cssLanguage?: "css" | "scss" | "less";
  jsLanguage?: "js" | "ts" | "vue" | "react";
  importedCssPenIds?: string[];
  importedJsPenIds?: string[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export const createPen = async (data: PenData) => {
  try {
    const response = await api.post("/pens", data);
    return response.data;
  } catch (error) {
    console.error("Create pen error:", error);
    throw error;
  }
};

export const updatePen = async (id: string, data: Partial<PenData>) => {
  try {
    const response = await api.patch(`/pens/${id}`, data);
    return response.data;
  } catch (error) {
    console.error("Update pen error:", error);
    throw error;
  }
};

export const getUserPens = async (limit: number = 20, skip: number = 0) => {
  try {
    const response = await api.get("/pens/user/me", {
      params: { limit, skip }
    });
    const pens = Array.isArray(response.data) ? response.data : response.data.pens || [];

    return pens
      .filter((pen: any) => pen && typeof pen === 'object')
      .map((pen: any) => {
        const id = pen.id || pen._id;
        return {
          ...pen,
          id: typeof id === 'string' ? id : String(id || '')
        } as Pen;
      })
      .filter((pen: Pen) => pen.id.length > 0);
  } catch (error) {
    console.error("Get user pens error:", error);
    throw error;
  }
};

export const getPen = async (id: string) => {
  try {
    const response = await api.get(`/pens/${id}`);
    return response.data;
  } catch (error) {
    console.error("Get pen error:", error);
    throw error;
  }
};

export const getPublicPens = async () => {
  try {
    const response = await api.get("/pens/public");
    return response.data;
  } catch (error) {
    console.error("Get public pens error:", error);
    throw error;
  }
};

export const deletePen = async (id: string) => {
  try {
    const response = await api.delete(`/pens/${id}`);
    return response.data;
  } catch (error) {
    console.error("Delete pen error:", error);
    throw error;
  }
};
