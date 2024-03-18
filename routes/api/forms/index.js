const { z } = require('zod')
const { isMatch } = require('date-fns')
const express = require('express')

const getFilteredResponses = require('./getFilteredResponses')
const validate = require('../../../lib/validate')

const router = express.Router()

const schema = z.object({
  params: z.object({}),
  query: z.object({
    limit: z.coerce.number().min(1).max(150).optional(),
    afterDate: z
      .string()
      .datetime()
      .optional()
      .refine(
        (arg) => {
          if (arg != null) {
            return isMatch(arg, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
          }
          return true
        },
        { message: 'afterDate must be in format YYYY-MM-DDTHH:mm:ss.sssZ' },
      ),
    beforeDate: z
      .string()
      .datetime()
      .optional()
      .refine(
        (arg) => {
          if (arg != null) {
            return isMatch(arg, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
          }
          return true
        },
        { message: 'afterDate must be in format YYYY-MM-ddTHH:mm:ss.sssZ' },
      ),
    offset: z.coerce.number().optional(),
    status: z.enum(['in_progress', 'finished']).optional(),
    includeEditLink: z.boolean().optional(),
    sort: z.enum(['asc', 'desc']).optional(),
    filters: z.string().optional(),
  }),
})

router.get('/:formId/filteredResponses', validate(schema), getFilteredResponses)

module.exports = router
