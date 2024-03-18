const express = require('express')
const router = express.Router()

const formsRouter = require('./forms')

router.use('/forms', formsRouter)

module.exports = router
