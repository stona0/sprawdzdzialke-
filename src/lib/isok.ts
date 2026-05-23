export interface IsokResult {
  strefy: string[]
  found: boolean
}

export async function checkFloodZones(lat: number, lng: number): Promise<IsokResult> {
  // ISOK WMS – sprawdzenie stref zalewowych dla punktu
  // Placeholder – pełna implementacja w Promptcie #3/#5
  return { strefy: [], found: false }
}
