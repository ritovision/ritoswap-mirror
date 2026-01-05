// dapp/components/chatBot/forms/battleFormSchema.ts
import { z } from 'zod';

export const battleFormSchema = z.object({
  user: z.object({
    favoriteBlockchains: z.string().max(50).optional(),
    favoriteNftCollection: z.string().max(50).optional(),
    placeOfOrigin: z.string().max(50).optional(),
    careerJobTitles: z.string().max(100).optional(),
    personalQuirks: z.string().max(200).optional(),
    thingsToBragAbout: z.string().max(200).optional(),
    thingsToBeAshamedOf: z.string().max(200).optional(),
  }),
  chatbot: z.object({
    favoriteBlockchains: z.string().max(50).optional(),
    favoriteNftCollection: z.string().max(50).optional(),
    placeOfOrigin: z.string().max(50).optional(),
    careerJobTitles: z.string().max(100).optional(),
    personalQuirks: z.string().max(200).optional(),
    thingsToBragAbout: z.string().max(200).optional(),
    thingsToBeAshamedOf: z.string().max(200).optional(),
  }),
});

export type BattleFormData = z.infer<typeof battleFormSchema>;

export const defaultFormData: BattleFormData = {
  user: {
    favoriteBlockchains: '',
    favoriteNftCollection: '',
    placeOfOrigin: '',
    careerJobTitles: '',
    personalQuirks: '',
    thingsToBragAbout: '',
    thingsToBeAshamedOf: '',
  },
  chatbot: {
    favoriteBlockchains: '',
    favoriteNftCollection: '',
    placeOfOrigin: '',
    careerJobTitles: '',
    personalQuirks: '',
    thingsToBragAbout: '',
    thingsToBeAshamedOf: '',
  },
};