const fs = require('fs');
let code = fs.readFileSync('src/components/teacher/ModulAjarGenerator.tsx', 'utf8');

const oldPrompt = `      const promptStr = \`Sebagai pakar Kurikulum Merdeka di Indonesia, buatkan Modul Ajar (Deep Learning) dalam bentuk tabel spreadsheet rapi.

Informasi Dasar:
- Mata Pelajaran: \${selectedSubject}
- Fase: \${selectedFase}
- Kelas: \${selectedClass}
- Tahun Ajaran: \${selectedPromes.content?.schoolYear || '-'}

Data PROMES Referensi:
"""
\${selectedPromes.content?.content || 'Tidak ada konten PROMES'}
"""

Fokus Pembelajaran (Tujuan Pembelajaran, Alokasi Waktu (JP), & Pertemuan) yang dipilih:
"\${tujuanPembelajaran}" (Catatan: Tujuan pembelajaran, alokasi waktu JP, dan jumlah pertemuan pada hasil modul ajar harus sama persis dengan informasi ini yang merujuk pada file prosem).

Praktik Pedagogis per Pertemuan: \${selectedPedagogis.join(', ')}
Dimensi Lulusan (Profil Pelajar Pancasila): \${selectedDimensi.join(', ')}

Instruksi Pembuatan Modul Ajar:
Output harus berupa rencana pembelajaran terstruktur dengan 5 bagian utama dalam bentuk tabel HTML murni (bukan Markdown biasa) dengan struktur spreadsheet yang rapi.
Format tulisan rata kanan kiri (justify) sesuai dengan ejaan bahasa Indonesia yang baik dan benar.

Gunakan tag <table>, <thead>, <tbody>, <tr>, <th>, <td>. Jangan bungkus output dengan backtick \\\`\\\`\\\`html.

BAGIAN 1: Identitas
- Nama Satuan Pendidikan (kosongi saja/beri titik-titik)
- Mata Pelajaran (\${selectedSubject})
- Kelas/Semester (\${selectedClass})
- Durasi Pertemuan (sesuai tujuan pembelajaran yang dipilih di atas)

BAGIAN 2: Identifikasi
- Siswa (generated otomatis sesuai konteks kelas)
- Materi Pelajaran (sesuai TP)
- Capaian Dimensi Lulusan (\${selectedDimensi.join(', ')})

BAGIAN 3: Desain Pembelajaran
- Capaian Pembelajaran (sesuaikan)
- Rencana Asesmen (asesmen formatif dan asesmen sumatif)
- Lintas Disiplin Ilmu (generate otomatis)
- Tujuan Pembelajaran (sesuai TP di atas)
- Topik Pembelajaran (disesuaikan oleh AI)
- Praktik Pedagogis per Pertemuan (\${selectedPedagogis.join(', ')})
- Kemitraan Pembelajaran (generate otomatis)
- Lingkungan Pembelajaran (generate otomatis)
- Pemanfaatan Digital (generate otomatis beserta referensi tools online yang sesuai)

BAGIAN 4: Pengalaman Belajar
Buatkan rincian kegiatan pembelajaran yang memuat:
- Memahami (berkesadaran, bermakna, menggembirakan) -> generated otomatis sesuaikan langkah dalam kegiatan awal.
- Mengaplikasi (berkesadaran, bermakna, menggembirakan) -> generated otomatis sesuai kegiatan inti berdasarkan sintaks praktik pedagogis (\${selectedPedagogis.join(', ')}).
- Refleksi (berkesadaran, bermakna, menggembirakan) -> generated otomatis sesuai langkah penutup.

BAGIAN 5: Asesmen Pembelajaran & LKPD Lengkap
Didalamnya memuat:
- Asesmen Awal (diagnostik/apersepsi) generated otomatis
- Asesmen Proses (observasi, rubrik, diskusi) generated otomatis
- Asesmen Akhir (produk, tugas, presentasi, portofolio) generated otomatis pada pertemuan terakhir.

Pastikan output menggunakan <table> HTML murni yang rapi dan terstruktur, bisa digabung menggunakan rowspan/colspan jika diperlukan.\`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptStr,
        config: {
          temperature: 0.7,
        }
      });
      
      let responseText = response.text || '';
      responseText = responseText.replace(/\\x60\\x60\\x60html\\n?/gi, '').replace(/\\x60\\x60\\x60\\n?/g, '');
      setGeneratedModul(responseText);`;

const newPrompt = `      const promptStr = \`Sebagai pakar Kurikulum Merdeka di Indonesia, buatkan Modul Ajar (Deep Learning).

Informasi Dasar:
- Mata Pelajaran: \${selectedSubject}
- Fase: \${selectedFase}
- Kelas: \${selectedClass}
- Tahun Ajaran: \${selectedPromes.content?.schoolYear || '-'}

Data PROMES Referensi:
"""
\${selectedPromes.content?.content || 'Tidak ada konten PROMES'}
"""

Fokus Pembelajaran (Tujuan Pembelajaran, Alokasi Waktu (JP), & Pertemuan) yang dipilih:
"\${tujuanPembelajaran}" (Catatan: Tujuan pembelajaran, alokasi waktu JP, dan jumlah pertemuan pada hasil modul ajar harus sama persis dengan informasi ini yang merujuk pada file prosem).

Praktik Pedagogis per Pertemuan: \${selectedPedagogis.join(', ')}
Dimensi Lulusan (Profil Pelajar Pancasila): \${selectedDimensi.join(', ')}

Instruksi Pembuatan Modul Ajar:
Output HARUS berupa JSON murni dengan struktur persis seperti berikut (jangan gunakan markdown backticks, kembalikan JSON raw saja):

{
  "identitas": {
    "namaSatuanPendidikan": "...",
    "mataPelajaran": "...",
    "kelasSemester": "...",
    "durasiPertemuan": "..."
  },
  "identifikasi": {
    "siswa": "...",
    "materiPelajaran": "...",
    "capaianDimensiLulusan": "..."
  },
  "desainPembelajaran": {
    "capaianPembelajaran": "...",
    "rencanaAsesmen": "...",
    "lintasDisiplinIlmu": "...",
    "tujuanPembelajaran": "...",
    "topikPembelajaran": "...",
    "praktikPedagogis": "...",
    "kemitraanPembelajaran": "...",
    "lingkunganPembelajaran": "...",
    "pemanfaatanDigital": "..."
  },
  "pengalamanBelajar": {
    "memahami": "...",
    "mengaplikasi": "...",
    "refleksi": "..."
  },
  "asesmenLkpd": {
    "asesmenAwal": "...",
    "asesmenProses": "...",
    "asesmenAkhir": "..."
  }
}

Setiap value berupa string (bisa multi-baris jika perlu, dipisahkan \\n).
Jangan tambahkan tag HTML seperti <table>. Kembalikan JSON saja.\`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptStr,
        config: {
          temperature: 0.7,
          responseMimeType: 'application/json'
        }
      });
      
      let responseText = response.text || '{}';
      setGeneratedModul(responseText);`;

if (!code.includes(oldPrompt)) {
  console.log("Could not find the exact old prompt structure.");
} else {
  code = code.replace(oldPrompt, newPrompt);
}

const importMarkdown = `import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';`;

const importModulView = `import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import ModulAjarView from './ModulAjarView';`;

code = code.replace(importMarkdown, importModulView);

const renderMarkdown = `<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{generatedModul}</ReactMarkdown>`;
const renderModulView = `<ModulAjarView dataStr={generatedModul} />`;

code = code.replace(renderMarkdown, renderModulView);

fs.writeFileSync('src/components/teacher/ModulAjarGenerator.tsx', code);
