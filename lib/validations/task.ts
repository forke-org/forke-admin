import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(10, 'Title must be at least 10 characters')
    .max(100, 'Title cannot exceed 100 characters'),
  description: z
    .string()
    .min(30, 'Description must be at least 30 characters')
    .max(1000, 'Description cannot exceed 1000 characters'),
  budget: z
    .number()
    .min(10000, 'Budget must be at least ₹100')
    .max(10000000, 'Budget cannot exceed ₹1,00,000'),
  deadline: z
    .date()
    .optional()
    .nullable()
    .refine((date) => !date || date > new Date(), {
      message: 'Deadline must be in the future',
    }),
  skillTags: z
    .array(z.string().min(1).max(30))
    .min(1, 'Select at least one tag')
    .max(5, 'Maximum 5 tags allowed'),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
