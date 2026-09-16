import { jsonrepair } from 'jsonrepair';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface KegiatanDetail {
  alokasiWaktu?: string;
  kegiatan?: string[];
}

interface PertemuanData {
  nomorPertemuan?: string;
  tujuanPembelajaranKhusus?: string;
  pengalamanBelajar?: {
    kegiatanAwal?: KegiatanDetail;
    kegiatanInti?: KegiatanDetail;
    kegiatanPenutup?: KegiatanDetail;
    // Legacy support
    memahami?: string;
    mengaplikasi?: string;
    refleksi?: string;
  };
  asesmenLkpd?: {
    tataCaraPenilaian?: string;
    metodePenilaian?: string;
    asesmenSumatif?: string;
    lkpdDetail?: string;
    // Legacy support
    lkpd?: string;
    rubrikPenilaian?: string;
  };
}

interface ModulAjarData {
  identitas?: {
    namaSatuanPendidikan?: string;
    mataPelajaran?: string;
    kelasSemester?: string;
    durasiPertemuan?: string;
  };
  identifikasi?: {
    siswa?: string;
    materiPelajaran?: string;
    capaianDimensiLulusan?: string;
  };
  desainPembelajaran?: {
    capaianPembelajaran?: string;
    rencanaAsesmen?: string;
    lintasDisiplinIlmu?: string;
    tujuanPembelajaran?: string;
    topikPembelajaran?: string;
    praktikPedagogis?: string;
    kemitraanPembelajaran?: string;
    lingkunganPembelajaran?: string;
    pemanfaatanDigital?: string;
  };
  pertemuan?: PertemuanData[];
  // Legacy fields
  pengalamanBelajar?: {
    memahami?: string;
    mengaplikasi?: string;
    refleksi?: string;
  };
  asesmenLkpd?: {
    asesmenAwal?: string;
    asesmenProses?: string;
    asesmenAkhir?: string;
  };
}

interface ModulAjarViewProps {
  dataStr: string;
  signatureNode?: React.ReactNode;
}

export default function ModulAjarView({ dataStr, signatureNode }: ModulAjarViewProps) {
  let data: ModulAjarData | null = null;
  try {
    let cleanData = dataStr.trim();
    if (cleanData.startsWith('```json')) {
      cleanData = cleanData.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanData.startsWith('```')) {
      cleanData = cleanData.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    try {
      cleanData = jsonrepair(cleanData);
    } catch (repairErr) {
      console.warn("jsonrepair failed:", repairErr);
    }
    data = JSON.parse(cleanData);
  } catch (e) {
    console.error("Failed to parse Modul Ajar JSON:", e, dataStr.substring(0, 100));
    // Fallback if it's not valid JSON (e.g., legacy HTML)
    return (
      <div className="p-4 bg-white border border-red-200 rounded-xl text-red-700">
        <h3 className="font-bold mb-2">Error Parsing Data</h3>
        <p className="text-sm mb-4">Hasil output tidak sesuai format yang diharapkan. Menampilkan raw data:</p>
        <pre className="text-xs whitespace-pre-wrap bg-gray-50 p-4 rounded overflow-auto max-h-[500px] border border-gray-200">
          {dataStr}
        </pre>
      </div>
    );
  }

  if (!data || !data.identitas) {
    return (
      <div className="p-4 bg-white border border-amber-200 rounded-xl text-amber-700">
        <h3 className="font-bold mb-2">Format Data Tidak Lengkap</h3>
        <p className="text-sm mb-4">Properti identitas tidak ditemukan. Menampilkan raw data:</p>
        <pre className="text-xs whitespace-pre-wrap bg-gray-50 p-4 rounded overflow-auto max-h-[500px] border border-gray-200">
          {dataStr}
        </pre>
      </div>
    );
  }

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 style={{ backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', color: '#312e81', padding: '8px 16px', fontSize: '14px', textTransform: 'uppercase', margin: '16px 0 0 0' }} className="font-bold tracking-wider">
      {children}
    </h2>
  );

  const SubSectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', color: '#1f2937', padding: '8px 16px', fontSize: '12px', textTransform: 'uppercase', margin: '16px 0 0 0' }} className="font-bold tracking-wider">
      {children}
    </h3>
  );

  const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0, borderBottom: '1px solid #e5e7eb' }}>
      <tbody>
        <tr>
          <td style={{ width: '30%', verticalAlign: 'top', backgroundColor: '#f9fafb', borderRight: '1px solid #e5e7eb', padding: '12px 16px', fontSize: '12px' }} className="font-semibold text-xs text-gray-700">
            {label}
          </td>
          <td style={{ width: '70%', verticalAlign: 'top', padding: '12px 16px', fontSize: '14px' }} className="text-sm text-gray-800 whitespace-pre-wrap">
            {typeof value === 'string' ? (
              <div className="prose prose-sm max-w-none prose-indigo markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{value}</ReactMarkdown>
              </div>
            ) : (
              value || '-'
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );

  const renderKegiatan = (detail?: KegiatanDetail, legacyString?: string) => {
    if (detail && detail.kegiatan && Array.isArray(detail.kegiatan)) {
      return (
        <div className="flex flex-col gap-2">
          {detail.alokasiWaktu && <div className="font-semibold text-xs text-indigo-700 mb-1">Alokasi Waktu: {detail.alokasiWaktu}</div>}
          <div className="space-y-2">
            {detail.kegiatan.map((k, i) => (
              <div key={i} className="text-gray-800 leading-relaxed text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{k}</ReactMarkdown>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return legacyString ? <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{legacyString}</ReactMarkdown> : '-';
  };

  return (
    <div id="recap-print-wrapper" className="flex flex-col border border-gray-200 bg-white">
      {/* Front Page / General Info */}
      <div className="flex flex-col">
        <SectionTitle>Bagian 1: Identitas</SectionTitle>
        <div className="flex flex-col">
          <Row label="Nama Satuan Pendidikan" value={data.identitas.namaSatuanPendidikan} />
          <Row label="Mata Pelajaran" value={data.identitas.mataPelajaran} />
          <Row label="Kelas / Semester" value={data.identitas.kelasSemester} />
          <Row label="Durasi Pertemuan" value={data.identitas.durasiPertemuan} />
        </div>

        <SectionTitle>Bagian 2: Identifikasi</SectionTitle>
        <div className="flex flex-col">
          <Row label="Siswa" value={data.identifikasi?.siswa} />
          <Row label="Materi Pelajaran" value={data.identifikasi?.materiPelajaran} />
          <Row label="Capaian Dimensi Lulusan" value={data.identifikasi?.capaianDimensiLulusan} />
        </div>

        <SectionTitle>Bagian 3: Desain Pembelajaran</SectionTitle>
        <div className="flex flex-col">
          <Row label="Capaian Pembelajaran" value={data.desainPembelajaran?.capaianPembelajaran} />
          <Row label="Rencana Asesmen" value={data.desainPembelajaran?.rencanaAsesmen} />
          <Row label="Lintas Disiplin Ilmu" value={data.desainPembelajaran?.lintasDisiplinIlmu} />
          <Row label="Tujuan Pembelajaran" value={data.desainPembelajaran?.tujuanPembelajaran} />
          <Row label="Topik Pembelajaran" value={data.desainPembelajaran?.topikPembelajaran} />
          <Row label="Praktik Pedagogis" value={data.desainPembelajaran?.praktikPedagogis} />
          <Row label="Kemitraan Pembelajaran" value={data.desainPembelajaran?.kemitraanPembelajaran} />
          <Row label="Lingkungan Pembelajaran" value={data.desainPembelajaran?.lingkunganPembelajaran} />
          <Row label="Pemanfaatan Digital" value={data.desainPembelajaran?.pemanfaatanDigital} />
        </div>
      </div>

      {data.pertemuan && data.pertemuan.length > 0 ? (
        <>
          <SectionTitle>Bagian 4: Pengalaman Belajar & Bagian 5: Asesmen (Per Pertemuan)</SectionTitle>
          <div className="flex flex-col">
            {data.pertemuan.map((p, index) => (
              <div key={index} className="flex flex-col print:break-before-page border-t-[8px] border-gray-100 print:border-t-0">
                <SubSectionTitle>{p.nomorPertemuan || `Pertemuan ${index + 1}`}</SubSectionTitle>
                <Row label="Tujuan Pembelajaran Khusus" value={p.tujuanPembelajaranKhusus} />
                
                <div style={{ backgroundColor: '#f9fafb', padding: '8px 16px', fontSize: '12px', color: '#4b5563', textTransform: 'uppercase', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                  Pengalaman Belajar
                </div>
                <Row label="Kegiatan Awal" value={renderKegiatan(p.pengalamanBelajar?.kegiatanAwal, p.pengalamanBelajar?.memahami)} />
                <Row label="Kegiatan Inti" value={renderKegiatan(p.pengalamanBelajar?.kegiatanInti, p.pengalamanBelajar?.mengaplikasi)} />
                <Row label="Kegiatan Penutup" value={renderKegiatan(p.pengalamanBelajar?.kegiatanPenutup, p.pengalamanBelajar?.refleksi)} />

                <div className="print:break-before-page border-t-[8px] border-gray-100 print:border-t-0 mt-8 pt-8 print:mt-0 print:pt-0">
                  <div style={{ backgroundColor: '#f9fafb', padding: '8px 16px', fontSize: '12px', color: '#4b5563', textTransform: 'uppercase', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                    Asesmen
                  </div>
                  
                  {/* Legacy support if lkpd/rubrik exist */}
                  {p.asesmenLkpd?.lkpd && <Row label="LKPD (Kegiatan & Formatif)" value={p.asesmenLkpd?.lkpd} />}
                  {p.asesmenLkpd?.rubrikPenilaian && p.asesmenLkpd.rubrikPenilaian !== '-' && p.asesmenLkpd.rubrikPenilaian.trim() !== '' && (
                    <Row label="Rubrik Penilaian" value={p.asesmenLkpd?.rubrikPenilaian} />
                  )}

                  {/* New Assesment Format */}
                  {p.asesmenLkpd?.tataCaraPenilaian && <Row label="Tata Cara Penilaian" value={p.asesmenLkpd?.tataCaraPenilaian} />}
                  {p.asesmenLkpd?.metodePenilaian && <Row label="Metode Penilaian" value={p.asesmenLkpd?.metodePenilaian} />}

                  {p.asesmenLkpd?.asesmenSumatif && p.asesmenLkpd.asesmenSumatif !== '-' && p.asesmenLkpd.asesmenSumatif.trim() !== '' && (
                    <Row label="Asesmen Sumatif" value={p.asesmenLkpd?.asesmenSumatif} />
                  )}

                  {/* Add signature at the bottom of each pertemuan page */}
                  {signatureNode && (
                    <div className="mt-8 mb-4">
                      {signatureNode}
                    </div>
                  )}
                </div>
                
                {/* Add LKPD Detail on a new page */}
                {p.asesmenLkpd?.lkpdDetail && p.asesmenLkpd.lkpdDetail !== '-' && p.asesmenLkpd.lkpdDetail.trim() !== '' && (
                  <div className="print:break-before-page border-t-[8px] border-gray-100 print:border-t-0 mt-8 pt-8 print:mt-0 print:pt-0">
                     <SubSectionTitle>LKPD - {p.nomorPertemuan || `Pertemuan ${index + 1}`}</SubSectionTitle>
                     <div style={{ padding: '16px', fontSize: '14px' }} className="prose prose-sm max-w-none prose-indigo markdown-body text-gray-800">
                       <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                         {p.asesmenLkpd.lkpdDetail}
                       </ReactMarkdown>
                     </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <SectionTitle>Bagian 4: Pengalaman Belajar</SectionTitle>
          <div className="flex flex-col">
            <Row label="Memahami (Awal)" value={data.pengalamanBelajar?.memahami} />
            <Row label="Mengaplikasi (Inti)" value={data.pengalamanBelajar?.mengaplikasi} />
            <Row label="Refleksi (Penutup)" value={data.pengalamanBelajar?.refleksi} />
          </div>

          <SectionTitle>Bagian 5: Asesmen Pembelajaran & LKPD</SectionTitle>
          <div className="flex flex-col">
            <Row label="Asesmen Awal" value={data.asesmenLkpd?.asesmenAwal} />
            <Row label="Asesmen Proses" value={data.asesmenLkpd?.asesmenProses} />
            <Row label="Asesmen Akhir" value={data.asesmenLkpd?.asesmenAkhir} />
          </div>
          
          {signatureNode && (
            <div className="mt-8 mb-4">
              {signatureNode}
            </div>
          )}
        </>
      )}
    </div>
  );
}
