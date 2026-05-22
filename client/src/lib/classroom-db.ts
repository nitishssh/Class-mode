import Dexie, { Table } from "dexie";

export interface CachedClassroom {
  id: string;
  dbId?: number;
  topic: string;
  cachedAt: number;
  data: any;
}

class ClassroomDatabase extends Dexie {
  classrooms!: Table<CachedClassroom, string>;

  constructor() {
    super("PLPro_Classrooms");
    this.version(1).stores({
      classrooms: "id, topic, cachedAt",
    });
  }
}

export const classroomDb = new ClassroomDatabase();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function cacheClassroom(data: any, dbId?: number): Promise<void> {
  await classroomDb.classrooms.put({
    id: data.id,
    dbId,
    topic: data.topic,
    cachedAt: Date.now(),
    data,
  });
}

export async function getCachedClassroom(id: string): Promise<any | null> {
  const cached = await classroomDb.classrooms.get(id);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
    await classroomDb.classrooms.delete(id);
    return null;
  }
  return cached.data;
}

export async function listCachedClassrooms(): Promise<CachedClassroom[]> {
  return classroomDb.classrooms.orderBy("cachedAt").reverse().toArray();
}

export async function deleteCachedClassroom(id: string): Promise<void> {
  await classroomDb.classrooms.delete(id);
}
