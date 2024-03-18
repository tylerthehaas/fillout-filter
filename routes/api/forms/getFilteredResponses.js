const axios = require('axios').default
const { isEqual, isBefore, isAfter } = require('date-fns')

const RESPONSE_LIMIT = 150

const questionTypeToValueMap = {
  Address: 'string',
  AudioRecording: 'string',
  Calcom: 'string',
  Calendly: 'string',
  Captcha: 'string',
  ColorPicker: 'string',
  CurrencyInput: 'string',
  DatePicker: 'date',
  DateTimePicker: 'date',
  Dropdown: 'string',
  EmailInput: 'string',
  FileUpload: 'string',
  ImagePicker: 'string',
  LocationCoordinates: 'string',
  LongAnswer: 'string',
  MultipleChoice: 'string',
  NumberInput: 'number',
  OpinionScale: 'string',
  Password: 'string',
  Payment: 'string',
  PhoneNumber: 'string',
  Ranking: 'number',
  RecordPicker: 'string',
  ShortAnswer: 'string',
  Signature: 'string',
  Slider: 'number',
  StarRating: 'number',
  TimePicker: 'date',
  URLInput: 'string',
}

async function getFilteredResponses(req, res) {
  try {
    const {
      limit: requestedLimit = 150,
      afterDate,
      beforeDate,
      offset: requestedOffset = 0,
      status = 'finished',
      includeEditLink = false,
      sort = 'asc',
      filters: rawFilters,
    } = req.query

    const { formId } = req.params

    const { data, totalResponses } = await axios.get(`https://api.fillout.com/v1/api/forms/${formId}/submissions`, {
      params: {
        limit: RESPONSE_LIMIT,
        afterDate,
        beforeDate,
        offset: 0,
        status,
        includeEditLink,
        sort,
      },
      headers: {
        Authorization: req.headers.authorization,
      },
    })

    const filters = JSON.parse(rawFilters)

    if (filters.length === 0) {
      return res.json(data)
    }

    const promises = []
    let responsesRequested = data.responses
    let offsetRequest = RESPONSE_LIMIT
    let filteredResponses = data.responses.filter((response) => filterResponse(response, filters))

    while (responsesRequested < totalResponses) {
      const promise = axios.get(`https://api.fillout.com/v1/api/forms/${formId}/submissions`, {
        params: {
          limit: RESPONSE_LIMIT,
          afterDate,
          beforeDate,
          offset: offsetRequest,
          status,
          includeEditLink,
          sort,
        },
        headers: {
          Authorization: req.headers.authorization,
        },
      })

      promises.push(promise)

      responsesRequested += RESPONSE_LIMIT
      offsetRequest += RESPONSE_LIMIT
    }

    const results = await Promise.all(promises)

    results.forEach(({ data }) => {
      const additionalFilteredResponses = data.responses.filter((response) => filterResponse(response, filters))
      filteredResponses.concat(additionalFilteredResponses)
    })

    const parsedOffset = Number(requestedOffset)
    const parsedLimit = Number(requestedLimit)

    const returnedResponses = filteredResponses.slice(parsedOffset, parsedOffset + parsedLimit)
    const pageCount = Math.ceil(filteredResponses.length / returnedResponses.length)

    res.json({ responses: returnedResponses, totalResponses: filteredResponses.length, pageCount })
  } catch (err) {
    res.status(err.statusCode ?? 500).json({ error: err.message })
  }
}

function filterResponse(response, filters = []) {
  return filters.every((filter) => {
    const targetQuestion = response.questions.find((question) => question.id === filter.id)
    return checkCondition(targetQuestion, filter)
  })
}

function checkCondition(question, filter) {
  const valueType = questionTypeToValueMap[question.type]
  if (valueType === 'date') {
    return checkDate(question, filter)
  } else if (valueType === 'number') {
    return checkNumber(question, filter)
  } else if (valueType === 'string') {
    return checkString(question, filter)
  } else {
    const error = new Error(`filter must be a date, number, or string`)
    error.statusCode = 400

    throw error
  }
}

function checkString(question, filter) {
  switch (filter.condition) {
    case 'equals':
      return question.value === filter.value

    case 'does_not_equal':
      return question.value !== filter.value

    default: {
      const error = new Error(
        `${filter.condition} not supported for string values. Must be either "equals" or "does_not_equal".`,
      )
      error.statusCode = 400
      throw error
    }
  }
}

function checkNumber(question, filter) {
  switch (filter.condition) {
    case 'equals':
      return question.value === filter.value

    case 'does_not_equal':
      return question.value !== filter.value

    case 'greater_than': {
      return question.value > filter.value
    }

    case 'less_than':
      return question.value < filter.value

    default: {
      const error = new Error(
        `${filter.condition} must be one of "equals", "does_not_equal", "greater_than", "less_than".`,
      )
      error.statusCode = 400
      throw error
    }
  }
}

function checkDate(question, filter) {
  const questionDate = new Date(question.value)
  const filterDate = new Date(filter.value)

  switch (filter.condition) {
    case 'equals':
      return isEqual(questionDate, filterDate)

    case 'does_not_equal':
      return !isEqual(questionDate, filterDate)

    case 'greater_than': {
      return isAfter(questionDate, filterDate)
    }

    case 'less_than':
      return isBefore(questionDate, filterDate)

    default: {
      const error = new Error(
        `${filter.condition} must be one of "equals", "does_not_equal", "greater_than", "less_than".`,
      )
      error.statusCode = 400
      throw error
    }
  }
}

module.exports = getFilteredResponses
