export type TtsSynthesisResult = {
  audio: ArrayBuffer;
  contentType: string;
};

export type TtsProvider = {
  synthesize: (text: string) => Promise<TtsSynthesisResult>;
};
