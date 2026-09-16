const fs = require('fs');
let code = fs.readFileSync('src/components/teacher/ModulAjarGenerator.tsx', 'utf8');

const regex = /const promptStr = \`Sebagai pakar Kurikulum Merdeka di Indonesia, buatkan Modul Ajar \(Deep Learning\)\.[\s\S]*?Setiap value berupa string \(bisa multi-baris jika perlu, dipisahkan \\n\)\.\nJangan tambahkan tag HTML seperti <table>\. Kembalikan JSON saja\.\`;/g;

const newPrompt = `const promptStr = \`Sebagai pakar Kurikulum Merdeka di Indonesia, buatkan Modul Ajar (Deep Learning).

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
Bagian 4 (Pengalaman Belajar) dan Bagian 5 (Asesmen & LKPD) HARUS dibuat rinciannya untuk SETIAP pertemuan berdasarkan jumlah pertemuan yang ada di "Fokus Pembelajaran".
Pada Bagian 4, sertakan Tujuan Pembelajaran Khusus per pertemuan dan Sintaks sesuai model pembelajaran/praktik pedagogis yang dipilih (\${selectedPedagogis.join(', ')}).
Pada Bagian 5, buatkan LKPD yang berisi kegiatan dan tugas formatif. Pada pertemuan terakhir, tambahkan Asesmen Sumatif.

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
  "pertemuan": [
    {
      "nomorPertemuan": "Pertemuan 1",
      "tujuanPembelajaranKhusus": "...",
      "pengalamanBelajar": {
        "memahami": "...",
        "mengaplikasi": "... (sertakan sintaks model pembelajaran di sini)",
        "refleksi": "..."
      },
      "asesmenLkpd": {
        "lkpd": "... (kegiatan dan tugas formatif)",
        "asesmenSumatif": "... (isi hanya pada pertemuan terakhir, selain itu kosongi atau beri strip)"
      }
    }
  ]
}

Setiap value berupa string (bisa multi-baris jika perlu, dipisahkan \\n).
Jangan tambahkan tag HTML seperti <table>. Kembalikan JSON saja.\`;`;

code = code.replace(regex, newPrompt);
fs.writeFileSync('src/components/teacher/ModulAjarGenerator.tsx', code);
