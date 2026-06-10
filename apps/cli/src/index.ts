#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { runPipeline } from './pipeline.js'

const program = new Command()

program
  .name('import-product')
  .description('AI Product Importer — Etapa 0 CLI spike')
  .requiredOption('--url <url>', 'Product URL to import')
  .option('--categories <path>', 'Path to categories CSV file')
  .option('--output <dir>', 'Output directory', './result')
  .option('--lang <lang>', 'Target language for AI content', 'cs')
  .action(async (options: { url: string; categories?: string; output: string; lang: string }) => {
    if (!process.env['OPENAI_API_KEY']) {
      console.error('Error: OPENAI_API_KEY environment variable is required')
      console.error('Copy .env.example to .env and fill in your API key')
      process.exit(1)
    }

    try {
      await runPipeline(options)
    } catch (err) {
      console.error('Pipeline failed:', err instanceof Error ? err.message : err)
      process.exit(1)
    }
  })

program.parse()
