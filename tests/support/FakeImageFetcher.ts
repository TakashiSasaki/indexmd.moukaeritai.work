export async function fakeImageFetcher(sampleId: string, variant: "preview" | "thumbnail" | "full" | "analysis") {
  return {
    buffer: Buffer.from("fake-image-bytes-for-" + sampleId + "-" + variant),
    mimeType: "image/jpeg",
    sourceUrlKind: "localFixture",
    cacheLayer: "miss",
    cacheKey: sampleId + "_" + variant,
    cacheStored: false
  };
}
