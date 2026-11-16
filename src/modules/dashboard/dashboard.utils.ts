import { format } from "date-fns";
import { id } from "date-fns/locale";

// Fungsi murni untuk mengolah data dashboard (tanpa query/req/res).

/**
 * Fungsi untuk mengelompokkan dokumen berdasarkan periode waktu
 */
export function groupDocumentsByTimePeriod(
  proposedChanges: any[],
  authDocs: any[],
  handovers: any[],
  period: string,
  startDate: Date,
  endDate: Date
): any[] {
  // Mapping untuk format tampilan berdasarkan periode
  const periodFormats: {[key: string]: string} = {
    'monthly': 'MMMM yyyy',
    'weekly': "'Week' w, yyyy",
    'daily': 'EEEE, dd MMMM yyyy',
    'hourly': 'HH:00, EEEE dd MMMM yyyy'
  };
  
  // Function to get period key for a date
  const getPeriodKey = (date: Date): string => {
    switch (period) {
      case 'monthly':
        return format(date, 'yyyy-MM');
      case 'weekly':
        return `${format(date, 'yyyy')}-W${format(date, 'ww')}`;
      case 'daily':
        return format(date, 'yyyy-MM-dd');
      case 'hourly':
        return format(date, 'yyyy-MM-dd HH');
      default:
        return format(date, 'yyyy-MM-dd');
    }
  };
  
  // Function to get formatted display date
  const getDisplayDate = (date: Date): string => {
    return format(date, periodFormats[period] || 'dd MMM yyyy', { locale: id });
  };
  
  // Generate all period keys in range
  const allPeriodKeys: {[key: string]: string} = {};
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const key = getPeriodKey(currentDate);
    allPeriodKeys[key] = getDisplayDate(currentDate);
    
    // Advance to next period
    switch (period) {
      case 'monthly':
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'hourly':
        currentDate.setHours(currentDate.getHours() + 1);
        break;
      default:
        currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  // Initialize result with all periods
  const result: {[key: string]: any} = {};
  
  Object.keys(allPeriodKeys).forEach(key => {
    result[key] = {
      period_key: key,
      period_label: allPeriodKeys[key],
      proposed_changes: {
        created: 0,
        documents: []
      },
      authorization_docs: {
        created: 0,
        documents: []
      },
      handovers: {
        created: 0,
        completed: 0,
        documents: []
      }
    };
  });
  
  // Group proposed changes
  proposedChanges.forEach(pc => {
    if (!pc.created_date) return;
    
    const key = getPeriodKey(new Date(pc.created_date));
    if (result[key]) {
      result[key].proposed_changes.created++;
      result[key].proposed_changes.documents.push({
        id: pc.id,
        created_date: pc.created_date,
        status: pc.status,
        department_id: pc.department_id,
        department_name: pc.department?.department_name || 'Unknown'
      });
    }
  });
  
  // Group authorization docs
  authDocs.forEach(auth => {
    if (!auth.created_date) return;
    
    const key = getPeriodKey(new Date(auth.created_date));
    if (result[key]) {
      result[key].authorization_docs.created++;
      result[key].authorization_docs.documents.push({
        id: auth.id,
        created_date: auth.created_date,
        status: auth.status,
        department_id: auth.department_id,
        department_name: auth.department?.department_name || 'Unknown'
      });
    }
  });
  
  // Group handovers
  handovers.forEach(h => {
    if (!h.created_date) return;
    
    const createdKey = getPeriodKey(new Date(h.created_date));
    if (result[createdKey]) {
      result[createdKey].handovers.created++;
      
      // Also count completed if applicable
      if (h.is_finished && h.finished_date) {
        const completedKey = getPeriodKey(new Date(h.finished_date));
        if (result[completedKey]) {
          result[completedKey].handovers.completed++;
        }
      }
      
      result[createdKey].handovers.documents.push({
        id: h.id,
        created_date: h.created_date,
        finished_date: h.finished_date,
        status: h.status,
        is_finished: h.is_finished,
        department_id: h.department_id,
        department_name: h.department?.department_name || 'Unknown'
      });
    }
  });
  
  // Convert to array and sort
  return Object.values(result).sort((a, b) => a.period_key.localeCompare(b.period_key));
}

/**
 * Menghitung ringkasan dokumen berdasarkan departemen
 */
export function summarizeByDepartment(
  proposedChanges: any[],
  authDocs: any[],
  handovers: any[]
): any[] {
  // Create department map to store counts
  const departmentMap: {[key: string]: any} = {};
  
  // Count proposed changes by department
  proposedChanges.forEach(pc => {
    const deptId = pc.department_id;
    const deptName = pc.department?.department_name || 'Unknown';
    
    if (!departmentMap[deptId]) {
      departmentMap[deptId] = {
        department_id: deptId,
        department_name: deptName,
        proposed_changes: 0,
        authorization_docs: 0,
        handovers: 0,
        completed: 0
      };
    }
    
    departmentMap[deptId].proposed_changes++;
  });
  
  // Count authorization docs by department
  authDocs.forEach(auth => {
    const deptId = auth.department_id;
    const deptName = auth.department?.department_name || 'Unknown';
    
    if (!departmentMap[deptId]) {
      departmentMap[deptId] = {
        department_id: deptId,
        department_name: deptName,
        proposed_changes: 0,
        authorization_docs: 0,
        handovers: 0,
        completed: 0
      };
    }
    
    departmentMap[deptId].authorization_docs++;
  });
  
  // Count handovers by department
  handovers.forEach(h => {
    const deptId = h.department_id;
    const deptName = h.department?.department_name || 'Unknown';
    
    if (!departmentMap[deptId]) {
      departmentMap[deptId] = {
        department_id: deptId,
        department_name: deptName,
        proposed_changes: 0,
        authorization_docs: 0,
        handovers: 0,
        completed: 0
      };
    }
    
    departmentMap[deptId].handovers++;
    
    if (h.is_finished) {
      departmentMap[deptId].completed++;
    }
  });
  
  // Convert to array and sort by proposed changes count (descending)
  return Object.values(departmentMap).sort((a, b) => b.proposed_changes - a.proposed_changes);
}

/**
 * Menghitung ringkasan dokumen berdasarkan status
 */
export function summarizeByStatus(documents: any[]): any {
  const statusMap: {[key: string]: number} = {};
  
  documents.forEach(doc => {
    const status = doc.status || 'unknown';
    statusMap[status] = (statusMap[status] || 0) + 1;
  });
  
  return statusMap;
}

/**
 * Menyiapkan data bulanan untuk tren dokumen
 */
export function prepareMonthlyData(
  startDate: Date,
  endDate: Date,
  proposedChanges: any[],
  authDocs: any[],
  handovers: any[]
): any[] {
  // Generate all months in the range
  const months: {[key: string]: any} = {};
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const monthKey = format(currentDate, 'yyyy-MM');
    months[monthKey] = {
      month_key: monthKey,
      month: format(currentDate, 'MMMM', { locale: id }),
      year: format(currentDate, 'yyyy'),
      proposed_changes: 0,
      authorization_docs: 0,
      handovers: 0,
      completed: 0
    };
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  // Count documents by month
  proposedChanges.forEach(doc => {
    if (!doc.created_date) return;
    
    const monthKey = format(new Date(doc.created_date), 'yyyy-MM');
    if (months[monthKey]) {
      months[monthKey].proposed_changes++;
    }
  });
  
  authDocs.forEach(doc => {
    if (!doc.created_date) return;
    
    const monthKey = format(new Date(doc.created_date), 'yyyy-MM');
    if (months[monthKey]) {
      months[monthKey].authorization_docs++;
    }
  });
  
  handovers.forEach(doc => {
    if (!doc.created_date) return;
    
    // Count created handovers
    const createdMonthKey = format(new Date(doc.created_date), 'yyyy-MM');
    if (months[createdMonthKey]) {
      months[createdMonthKey].handovers++;
    }
    
    // Count completed handovers
    if (doc.is_finished && doc.finished_date) {
      const finishedMonthKey = format(new Date(doc.finished_date), 'yyyy-MM');
      if (months[finishedMonthKey]) {
        months[finishedMonthKey].completed++;
      }
    }
  });
  
  // Convert to array and sort by month
  return Object.values(months).sort((a, b) => a.month_key.localeCompare(b.month_key));
}
/**
 * Menghasilkan array warna untuk grafik
 * Menggunakan warna yang kontras untuk readability
 */
export function generateColors(count: number): string[] {
  const baseColors = [
    '#FF6384', // Merah muda
    '#36A2EB', // Biru
    '#FFCE56', // Kuning
    '#4BC0C0', // Tosca
    '#9966FF', // Ungu
    '#FF9F40', // Oranye
    '#C9CBCF', // Abu-abu
    '#7FD47F', // Hijau
    '#FFA07A', // Salmon
    '#20B2AA', // Light sea green
    '#778899', // Light slate gray
    '#B0C4DE', // Light steel blue
    '#FFDEAD', // Navajo white
    '#DB7093', // Pale violet red
    '#F0E68C', // Khaki
    '#E6E6FA', // Lavender
    '#FFF0F5', // Lavender blush
    '#7B68EE', // Medium slate blue
    '#3CB371', // Medium sea green
    '#FA8072', // Salmon
  ];
  
  // Jika butuh lebih banyak warna, duplicate dan modifikasi baseColors
  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  } else {
    const colors = [...baseColors];
    for (let i = baseColors.length; i < count; i++) {
      // Generate warna acak jika butuh lebih banyak
      const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
      colors.push(randomColor);
    }
    return colors;
  }
}
